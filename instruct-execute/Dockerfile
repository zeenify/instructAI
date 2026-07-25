# 1. Use a Node.js base image
FROM node:22-bullseye

# 2. Install Java (JDK)
RUN apt-get update && \
    apt-get install -y default-jdk && \
    apt-get clean;

# 3. Set the working directory
WORKDIR /app

# 4. Copy package files and install Node dependencies
COPY package*.json ./
RUN npm install

# 5. Copy the rest of your code
COPY . .

# 6. Expose the port (Railway uses 3000 by default for Node)
EXPOSE 3000

# 7. Start the server
CMD ["node", "index.js"]