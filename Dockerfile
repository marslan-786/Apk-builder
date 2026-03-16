# Base Image
FROM node:18-bullseye

# Install Java, Unzip, and other necessary tools
RUN apt-get update && apt-get install -y \
    openjdk-17-jdk wget unzip git zip \
    && rm -rf /var/lib/apt/lists/*

# Set Environment Variables for Android SDK
ENV ANDROID_HOME /opt/android-sdk
ENV PATH ${PATH}:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools

# Download and Install Android Command Line Tools
RUN mkdir -p ${ANDROID_HOME}/cmdline-tools && \
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip -O android_tools.zip && \
    unzip -q android_tools.zip -d ${ANDROID_HOME}/cmdline-tools && \
    rm android_tools.zip && \
    mv ${ANDROID_HOME}/cmdline-tools/cmdline-tools ${ANDROID_HOME}/cmdline-tools/latest

# Accept Android Licenses and Install build-tools, platforms
RUN yes | sdkmanager --licenses && \
    sdkmanager "platform-tools" "platforms;android-33" "build-tools;33.0.2"

# Setup Node.js App Directory
WORKDIR /app

# Install NPM dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Expose port for Railway
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
