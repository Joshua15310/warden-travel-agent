import "dotenv/config";
import OpenAI from "openai";
import axios from "axios";
import { AgentServer } from "@wardenprotocol/agent-kit";
import type { TaskContext, TaskYieldUpdate, MessagePart } from "@wardenprotocol/agent-kit";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "localhost";
const BASE_URL = `http://${HOST}:${PORT}`;

const llm = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.GROK_API_KEY,
  baseURL: process.env.GROK_API_KEY ? "https://api.x.ai/v1" : undefined,
});

const RAPIDAPI_KEY = process.env.BOOKING_API_KEY;
const AMADEUS_API_KEY = process.env.AMADEUS_API_KEY;
const AMADEUS_API_SECRET = process.env.AMADEUS_API_SECRET;
let amadeusToken: string = "";
let tokenExpiry: Date | null = null;

async function getAmadeusToken(): Promise<string> {
  if (amadeusToken && tokenExpiry && tokenExpiry > new Date()) {
    return amadeusToken;
  }
  try {
    const response = await axios.post(
      "https://test.api.amadeus.com/v1/security/oauth2/token",
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: AMADEUS_API_KEY!,
        client_secret: AMADEUS_API_SECRET!,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    amadeusToken = response.data.access_token;
    tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);
    return amadeusToken;
  } catch (error: any) {
    console.error("getAmadeusToken error:", error.message || error);
    throw new Error(`Failed to get Amadeus token: ${error.message}`);
  }
}

async function searchFlights(origin: string, destination: string, departureDate: string) {
  try {
    const token = await getAmadeusToken();
    const response = await axios.get(
      "https://test.api.amadeus.com/v2/shopping/flight-offers",
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { originLocationCode: origin, destinationLocationCode: destination, departureDate, adults: 1, max: 10 },
      }
    );
    return (response.data.data || []).slice(0, 5).map((flight: any, i: number) => ({
      number: i + 1,
      airline: flight.itineraries[0]?.segments[0]?.carrierCode || "N/A",
      flightNumber: `${flight.itineraries[0]?.segments[0]?.carrierCode}${flight.itineraries[0]?.segments[0]?.number}`,
      departure: flight.itineraries[0]?.segments[0]?.departure?.at || "N/A",
      arrival: flight.itineraries[0]?.segments[0]?.arrival?.at || "N/A",
      duration: flight.itineraries[0]?.duration || "N/A",
      price: `${flight.price?.total || "N/A"} ${flight.price?.currency || "USD"}`,
      stops: flight.itineraries[0]?.segments?.length > 1 ? "1+ stops" : "Direct",
    }));
  } catch (error: any) {
    console.error("searchFlights error:", error.message || error);
    throw new Error(`Flight search failed: ${error.message}`);
  }
}

async function searchHotels(cityName: string, checkIn: string, checkOut: string) {
  try {
    // Step 1: Get destination ID
    const locResponse = await axios.get("https://booking-com15.p.rapidapi.com/api/v1/hotels/searchDestination", {
      params: { query: cityName, locale: "en-gb" },
      headers: { "X-RapidAPI-Key": RAPIDAPI_KEY!, "X-RapidAPI-Host": "booking-com15.p.rapidapi.com" },
    });
    
    const destId = locResponse.data?.data?.[0]?.dest_id;
    if (!destId) throw new Error("City not found");

    // Step 2: Search hotels
    const hotelResponse = await axios.get("https://booking-com15.p.rapidapi.com/api/v1/hotels/searchHotels", {
      params: {
        dest_id: destId,
        search_type: "city",
        arrival_date: checkIn,
        departure_date: checkOut,
        adults: "1",
        room_qty: "1",
        units: "metric",
        page_number: "1",
        temperature_unit: "c",
        languagecode: "en-us",
        currency_code: "USD",
      },
      headers: { "X-RapidAPI-Key": RAPIDAPI_KEY!, "X-RapidAPI-Host": "booking-com15.p.rapidapi.com" },
    });

    const hotels = (hotelResponse.data?.data?.hotels || []).slice(0, 5);
    return hotels.map((hotel: any, i: number) => ({
      number: i + 1,
      name: hotel.property?.name || "Unknown Hotel",
      rating: hotel.property?.reviewScore || "N/A",
      price: hotel.property?.priceBreakdown?.grossPrice?.value ? `$${Math.round(hotel.property?.priceBreakdown?.grossPrice?.value)}` : "N/A",
      location: hotel.property?.cityName || cityName,
      reviewCount: hotel.property?.reviewCount || 0,
    }));
  } catch (error: any) {
    throw new Error(`Hotel search failed: ${error.message}`);
  }
}

async function extractTravelInfo(userMessage: string) {
  try {
    const response = await llm.chat.completions.create({
      model: process.env.GROK_API_KEY ? "grok-3" : "gpt-4o-mini",
      messages: [
        { role: "system", content: `Extract travel details. Return JSON with: intent (search_flights|search_hotels|search_both|general_chat), origin (IATA code), destination (IATA code or city name), departureDate (YYYY-MM-DD), checkIn (YYYY-MM-DD), checkOut (YYYY-MM-DD).` },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
    });
    return JSON.parse(response.choices[0]?.message?.content || "{}");
  } catch (error: any) {
    console.error("extractTravelInfo error:", error.message || error);
    return { intent: "general_chat" };
  }
}

const server = new AgentServer({
  agentCard: {
    name: "Warden Travel Research",
    description: "AI travel assistant - searches real flights (Amadeus) and hotels (Booking.com) worldwide",
    url: BASE_URL,
    version: "0.3.0",
    capabilities: { streaming: false, multiTurn: true },
  },
  handler: async function* (context: TaskContext): AsyncGenerator<TaskYieldUpdate> {
    const userMessage = context.message.parts?.filter((p): p is MessagePart & { type: "text" } => p.type === "text").map((p) => p.text).join("\n");
    if (!userMessage) {
      yield { state: "completed", message: { role: "agent", parts: [{ type: "text", text: "No message received." }] } };
      return;
    }
    try {
      yield { state: "working" };
      const info = await extractTravelInfo(userMessage);
      
      if (info.intent === "search_flights" && info.origin && info.destination && info.departureDate) {
        const flights = await searchFlights(info.origin, info.destination, info.departureDate);
        let text = ` Flights from ${info.origin} to ${info.destination} (${info.departureDate})\n\n`;
        flights.forEach((f: any) => {
          text += `${f.number}. ${f.airline} ${f.flightNumber}\n   Depart: ${f.departure}\n   Arrive: ${f.arrival}\n   Duration: ${f.duration}\n   Price: ${f.price}\n   Type: ${f.stops}\n\n`;
        });
        text += `Book at: Google Flights, Kayak, or airline websites`;
        yield { state: "completed", message: { role: "agent", parts: [{ type: "text", text }] } };
      } else if (info.intent === "search_hotels" && info.destination && info.checkIn && info.checkOut) {
        const hotels = await searchHotels(info.destination, info.checkIn, info.checkOut);
        let text = ` Hotels in ${info.destination} (${info.checkIn} to ${info.checkOut})\n\n`;
        hotels.forEach((h: any) => {
          text += `${h.number}. ${h.name}\n   Rating: ${h.rating}/10 (${h.reviewCount} reviews)\n   Price: ${h.price} total\n   Location: ${h.location}\n\n`;
        });
        text += `Book at: Booking.com, Hotels.com, or directly with hotels`;
        yield { state: "completed", message: { role: "agent", parts: [{ type: "text", text }] } };
      } else if (info.intent === "search_both" && info.origin && info.destination && info.departureDate && info.checkIn && info.checkOut) {
        const [flights, hotels] = await Promise.all([
          searchFlights(info.origin, info.destination, info.departureDate),
          searchHotels(info.destination, info.checkIn, info.checkOut),
        ]);
        let text = ` FLIGHTS from ${info.origin} to ${info.destination} (${info.departureDate})\n\n`;
        flights.forEach((f: any) => {
          text += `${f.number}. ${f.airline} ${f.flightNumber} - ${f.price} (${f.stops})\n`;
        });
        text += `\n HOTELS in ${info.destination} (${info.checkIn} to ${info.checkOut})\n\n`;
        hotels.forEach((h: any) => {
          text += `${h.number}. ${h.name} - ${h.price} (${h.rating}/10)\n`;
        });
        text += `\nBook flights: Google Flights, Kayak | Book hotels: Booking.com`;
        yield { state: "completed", message: { role: "agent", parts: [{ type: "text", text }] } };
      } else {
        const resp = await llm.chat.completions.create({
          model: process.env.GROK_API_KEY ? "grok-3" : "gpt-4o-mini",
          messages: [
            { role: "system", content: "Travel assistant. Help with flights and hotels. Examples: 'Find flights from NYC to London on March 15' or 'Show hotels in Paris from April 1-5' or 'Plan trip to Tokyo March 10-15'" },
            { role: "user", content: userMessage },
          ],
        });
        yield { state: "completed", message: { role: "agent", parts: [{ type: "text", text: resp.choices[0]?.message?.content || "" }] } };
      }
    } catch (error: any) {
      yield { state: "failed", message: { role: "agent", parts: [{ type: "text", text: `Error: ${error.message}` }] } };
    }
  },
});

server.listen(PORT).then(() => {
  const llmProvider = process.env.GROK_API_KEY ? "Grok" : "OpenAI";
  console.log(`\nWarden Travel Agent ready at ${BASE_URL}`);
  console.log(`LLM: ${llmProvider} - ${!!(process.env.GROK_API_KEY || process.env.OPENAI_API_KEY) ? "" : ""}`);
  console.log(`Amadeus (Flights): ${!!(AMADEUS_API_KEY && AMADEUS_API_SECRET) ? "" : ""}`);
  console.log(`Booking.com (Hotels): ${!!RAPIDAPI_KEY ? "" : ""}\n`);
});
