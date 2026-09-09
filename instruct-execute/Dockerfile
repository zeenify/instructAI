# 1. Use a Node.js base image
FROM node:22-bullseye

# 2. Install toolchains: Java (JDK), Python 3, C++ (g++)
#    Node.js is already provided by the base image.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        default-jdk \
        python3 \
        g++ && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 3. Set the working directory
WORKDIR /app

# 4. Copy package files and install Node dependencies
COPY package*.json ./
RUN npm install

# 5. Copy the rest of your code
COPY . .

# 6. Expose the port (Render/Railway use 3000 by default for Node)
EXPOSE 3000

# 7. Start the server
CMD ["node", "index.js"]
