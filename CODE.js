const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

// Check for API key
if (!process.env.GOOGLE_API_KEY) {
  console.error("GOOGLE_API_KEY is not set in environment variables!");
  process.exit(1);
}

// Set the ID of the server you want the bot to work in
const ALLOWED_SERVER_ID = '1258415543979999352'; // Replace with your server's ID

// Set the AI's emotion/personality here
const AI_EMOTION = "A Pirate"; // Change this to set the AI's emotion

// Set the bot's nickname here
const BOT_NICKNAME = "Pirate"; // Change this to set the bot's nickname

// Store the original nickname and emotion
let originalNickname = BOT_NICKNAME;
let originalEmotion = AI_EMOTION;

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// Initialize Google AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Store conversation history
const conversationHistory = new Map();

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
      await channel.send(`Ahoy, matey! I be yer AI ${BOT_NICKNAME} called ${BOT_NICKNAME}. Type \`/chat "yer question"\` to parley with me here, or \`/dm "yer question"\` to receive a secret message in a bottle!`);
      console.log(`Welcome message sent to ${channel.name} in ${guild.name}`);
    } else {
      console.log(`No suitable channel found in ${guild.name}`);
    }
  } catch (error) {
    console.error(`Error sending welcome message to ${guild.name}:`, error);
  }
}

// Function to generate AI response
async function generateAIResponse(prompt, userId) {
  let botName, botEmotion;

  if (conversationHistory.has(userId)) {
    const history = conversationHistory.get(userId);
    botName = history.nickname;
    botEmotion = history.emotion;
  } else {
    botName = BOT_NICKNAME;
    botEmotion = AI_EMOTION;
    conversationHistory.set(userId, { nickname: botName, emotion: botEmotion });
  }

  const fullPrompt = `You are ${botEmotion} named ${botName}. Respond to: "${prompt}"`;
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
      return "I'm having trouble generating a response. Please try again later.";
    }

    return text;
  } catch (error) {
    console.error("Error details:", error);
    return `An error occurred: ${error.message}`;
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
  if (message.author.bot) return;
  if (message.guild && message.guild.id !== ALLOWED_SERVER_ID) return;

  console.log(`Received message: ${message.content}`);

  if (message.content.startsWith("/chat")) {
    const userPrompt = message.content.slice(6).trim();
    const response = await generateAIResponse(userPrompt, message.author.id);
    const chunks = response.match(/.{1,2000}/g);
    for (const chunk of chunks) {
      console.log(`Sending chunk: ${chunk}`);
      await message.channel.send(chunk);
    }
    console.log("All chunks sent.");
  } else if (message.content.startsWith("/dm")) {
    const userPrompt = message.content.slice(4).trim();
    const response = await generateAIResponse(userPrompt, message.author.id);
    try {
      const chunks = response.match(/.{1,2000}/g);
      for (const chunk of chunks) {
        console.log(`Sending DM chunk: ${chunk}`);
        await message.author.send(chunk);
      }
      console.log("All DM chunks sent.");
      await message.channel.send("I've sent you a DM with my response!");
    } catch (error) {
      console.error("Error sending DM:", error);
      await message.channel.send("I couldn't send you a DM. Please check your privacy settings and ensure you allow DMs from server members.");
    }
  }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);

// To change the bot's nickname and emotion, modify these lines:
// const AI_EMOTION = "A Ninja";
// const BOT_NICKNAME = "Ninja";

// If you change the above constants, the code below will ensure that
// existing conversations keep the old personality while new ones use the new one.
if (BOT_NICKNAME !== originalNickname || AI_EMOTION !== originalEmotion) {
  console.log(`Bot personality changed from ${originalNickname} (${originalEmotion}) to ${BOT_NICKNAME} (${AI_EMOTION})`);
  console.log("Existing conversations will keep the original personality.");
  console.log("New conversations will use the new personality.");
}
