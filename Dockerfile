# Dockerfile
FROM ghcr.io/puppeteer/puppeteer:23.11.1

# Set the working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json .
# USER root
RUN npm install

# Fix permissions for node_modules
RUN chown -R pptruser:pptruser /app/node_modules

# Copy the Prisma schema folder
COPY prisma ./prisma
# Copy the rest of your application
COPY . .

RUN npm run build
# # Switch back to the default non-root user
# USER pptruser
# Build and start the application at runtime
CMD ["sh", "-c", "npm start"]
