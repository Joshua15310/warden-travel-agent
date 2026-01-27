# Warden Travel Agent

AI-powered travel assistant that searches real flights (Amadeus) and hotels (Booking.com) worldwide.

## Deploy to Render

1. Build command: 
pm install && npm run build
2. Start command: 
pm start
3. Environment variables:
   - GROK_API_KEY
   - AMADEUS_API_KEY
   - AMADEUS_API_SECRET
   - BOOKING_API_KEY
   - PORT (set to 10000 for Render)
   - HOST (set to 0.0.0.0 for Render)

## Features
- Real-time flight search via Amadeus API
- Global hotel search via Booking.com API
- A2A Protocol support for Warden integration
- Natural language processing with Grok AI
