# 1. Node.js base image — bookworm ships JDK 17, Python 3.11, GCC 12
#    (bullseye would pin JDK 11 / Python 3.9 and break modern student syntax)
FROM node:22-bookworm

# 2. Install toolchains: Java (JDK 17), Python 3.11, C++ (g++ 12)
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

# 6. Run as the unprivileged node user — student code must not be root
USER node

# 7. Expose the port (Render/Railway use 3000 by default for Node)
EXPOSE 3000

# 8. Start the server
CMD ["node", "index.js"]
