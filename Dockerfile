# Base Image
FROM node:18-bullseye

# 1. Install Java, Unzip, and other necessary tools
RUN apt-get update && apt-get install -y \
    openjdk-17-jdk wget unzip git zip \
    && rm -rf /var/lib/apt/lists/*

# 2. Set Environment Variables for Android SDK
ENV ANDROID_HOME /opt/android-sdk
ENV PATH ${PATH}:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools

# 3. Download and Install Android Command Line Tools
RUN mkdir -p ${ANDROID_HOME}/cmdline-tools && \
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-10406996_latest.zip -O android_tools.zip && \
    unzip -q android_tools.zip -d ${ANDROID_HOME}/cmdline-tools && \
    rm android_tools.zip && \
    mv ${ANDROID_HOME}/cmdline-tools/cmdline-tools ${ANDROID_HOME}/cmdline-tools/latest

# 4. Accept Android Licenses and Install Build Tools (Targeting SDK 34)
RUN yes | sdkmanager --licenses && \
    sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# 5. Download and Install Global Gradle
RUN wget -q https://services.gradle.org/distributions/gradle-8.4-bin.zip && \
    unzip -q gradle-8.4-bin.zip -d /opt/gradle && \
    rm gradle-8.4-bin.zip
ENV PATH ${PATH}:/opt/gradle/gradle-8.4/bin

# 6. Setup Node.js App Directory
WORKDIR /app

# 7. Install NPM dependencies
COPY package*.json ./
RUN npm install

# 8. Copy source code
COPY . .

# 9. Expose port for Railway
EXPOSE 3000

# 10. Start the server
CMD ["node", "server.js"]
