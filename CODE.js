const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

// Check for API key
if (!process.env.GOOGLE_API_KEY) {
  console.error("GOOGLE_API_KEY is not set in environment variables!");
  process.exit(1);
}

// Set the ID of the server you want the bot to work in
const ALLOWED_SERVER_ID = 'YOUR_SERVER_ID_HERE'; // Replace with your server's ID

// Set the AI's emotion/personality here
const AI_EMOTION = "a helpful and friendly AI assistant"; // Change this to set the AI's emotion

// Set the bot's nickname here
const BOT_NICKNAME = "AI Assistant"; // Change this to set the bot's nickname

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// Initialize Google AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Function to change bot nickname
async function setBotNickname(guild, nickname) {
  try {
    await guild.members.me.setNickname(nickname);
    console.log(`Set nickname to "${nickname}" in guild: ${guild.name}`);
  } catch (error) {
    console.error(`Failed to set nickname in ${guild.name}: ${error.message}`);
  }
}

// Function to send welcome message
async function sendWelcomeMessage(guild) {
  if (guild.id !== ALLOWED_SERVER_ID) return;
  
  console.log(`Sending welcome message to allowed guild: ${guild.name}`);
  try {
    const channel = guild.channels.cache.find(
      channel => channel.type === 0 && channel.permissionsFor(guild.members.me).has('SendMessages')
    );
    if (channel) {
      await channel.send(`Hello, I'm your AI Assistant. Type \`/chat "your question"\` to chat with me!`);
      console.log(`Welcome message sent to ${channel.name} in ${guild.name}`);
    } else {
      console.log(`No suitable channel found in ${guild.name}`);
    }
  } catch (error) {
    console.error(`Error sending welcome message to ${guild.name}:`, error);
  }
}

// Bot ready event
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);  

  const allowedGuild = client.guilds.cache.get(ALLOWED_SERVER_ID);
  if (allowedGuild) {
    await sendWelcomeMessage(allowedGuild);
    await setBotNickname(allowedGuild, BOT_NICKNAME);
  } else {
    console.log(`Bot is not in the allowed server (ID: ${ALLOWED_SERVER_ID})`);
  }
});

// Message creation event
client.on("messageCreate", async (message) => {
  // Ignore messages from other servers
  if (message.guild.id !== ALLOWED_SERVER_ID) return;

  console.log(`Received message: ${message.content}`);

  if (message.author.bot) return;

  if (message.content.startsWith("/chat")) {
    console.log("Chat command detected.");
    const userPrompt = message.content.slice(6);
    const fullPrompt = `You are ${AI_EMOTION}. Respond to: "${userPrompt}"`;
    console.log(`Full Prompt: ${fullPrompt}`);
    
    try {
      console.log("Attempting to generate content...");
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const result = await model.generateContent(fullPrompt);
      console.log("Content generated successfully.");
      const response = result.response;
      const text = response.text();
      console.log(`Generated text: ${text}`);

      if (!text || text.length < 5) {
        message.channel.send("I'm having trouble generating a response. Please try again later.");
        return;
      }

      // Split the response into chunks of 2000 characters or less
      const chunks = text.match(/.{1,2000}/g);
      for (const chunk of chunks) {
        console.log(`Sending chunk: ${chunk}`);
        await message.channel.send(chunk);
      }
      console.log("All chunks sent.");
    } catch (error) {
      console.error("Error details:", error);
      message.channel.send(`An error occurred: ${error.message}`);
    }
  } else {
    console.log("Message does not start with '/chat', ignoring.");
  }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);
