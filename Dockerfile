# Build stage
FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
ENV PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "serve -s dist"]
