const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

// Check for API key
if (!process.env.GOOGLE_API_KEY) {
  console.error("GOOGLE_API_KEY is not set in environment variables!");
  process.exit(1);
}

// Initialize Google AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

class AIBot {
  constructor(config) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [Partials.Channel, Partials.Message],
    });
    this.token = config.token;
    this.nickname = config.nickname;
    this.emotion = config.emotion;
    this.serverId = config.serverId;
    this.prefix = config.prefix || '/';
    this.conversationHistory = new Map(); // Store conversation history

    this.client.on("ready", this.onReady.bind(this));
    this.client.on("messageCreate", this.onMessageCreate.bind(this));
  }

  async onReady() {
    console.log(`Logged in as ${this.client.user.tag}!`);
    const allowedGuild = this.client.guilds.cache.get(this.serverId);
    if (allowedGuild) {
      await this.sendWelcomeMessage(allowedGuild);
      await this.setBotNickname(allowedGuild);
    } else {
      console.log(`Bot ${this.nickname} is not in the allowed server (ID: ${this.serverId})`);
    }
  }

  async setBotNickname(guild) {
    try {
      await guild.members.me.setNickname(this.nickname);
      console.log(`Set nickname to "${this.nickname}" for ${this.client.user.tag} in guild: ${guild.name}`);
    } catch (error) {
      console.error(`Failed to set nickname for ${this.client.user.tag} in ${guild.name}: ${error.message}`);
    }
  }

  async sendWelcomeMessage(guild) {
    console.log(`Sending welcome message to allowed guild: ${guild.name}`);
    try {
      const channel = guild.channels.cache.find(
        channel => channel.type === 0 && channel.permissionsFor(guild.members.me).has('SendMessages')
      );
      if (channel) {
        await channel.send(`Hello, I'm you Swift AI called ${this.nickname},. Type \`${this.prefix}chat "your question"\` to chat with me here, or \`${this.prefix}dm "your question"\` to receive a DM!`);
        console.log(`Welcome message sent to ${channel.name} in ${guild.name} for ${this.client.user.tag}`);
      } else {
        console.log(`No suitable channel found in ${guild.name} for ${this.client.user.tag}`);
      }
    } catch (error) {
      console.error(`Error sending welcome message to ${guild.name} for ${this.client.user.tag}:`, error);
    }
  }

  async generateAIResponse(prompt, userId, isDM = false) {
    let botName = this.nickname;
    let botEmotion = this.emotion;

    // Check if there's a previous conversation with this user
    if (this.conversationHistory.has(userId)) {
      const history = this.conversationHistory.get(userId);
      botName = history.nickname;
      botEmotion = history.emotion;
    } else {
      // If it's a new conversation, store the current name and emotion
      this.conversationHistory.set(userId, { nickname: this.nickname, emotion: this.emotion });
    }

    let fullPrompt = `You are ${botEmotion}. Respond to: "${prompt}"`;
    if (isDM) {
      fullPrompt = `You are ${botEmotion} named ${botName}. Start your response with 'As ${botName}, '. Now respond to: "${prompt}"`;
    }
    console.log(`Full Prompt for ${this.client.user.tag}: ${fullPrompt}`);

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();
      console.log(`Generated text for ${this.client.user.tag}: ${text}`);

      if (!text || text.length < 5) {
        return "I'm having trouble generating a response. Please try again later.";
      }

      return text;
    } catch (error) {
      console.error(`Error details for ${this.client.user.tag}:`, error);
      return `An error occurred: ${error.message}`;
    }
  }

  async onMessageCreate(message) {
    if (message.author.bot) return;
    if (message.guild && message.guild.id !== this.serverId) return;

    console.log(`Received message for ${this.client.user.tag}: ${message.content}`);

    if (message.content.startsWith(`${this.prefix}chat`)) {
      const userPrompt = message.content.slice(this.prefix.length + 5).trim();
      const response = await this.generateAIResponse(userPrompt, message.author.id);

      const chunks = response.match(/.{1,2000}/g);
      for (const chunk of chunks) {
        console.log(`Sending chunk for ${this.client.user.tag}: ${chunk}`);
        await message.channel.send(chunk);
      }
      console.log(`All chunks sent for ${this.client.user.tag}.`);
    } else if (message.content.startsWith(`${this.prefix}dm`)) {
      const userPrompt = message.content.slice(this.prefix.length + 3).trim();
      const response = await this.generateAIResponse(userPrompt, message.author.id, true);

      try {
        const chunks = response.match(/.{1,2000}/g);
        for (const chunk of chunks) {
          console.log(`Sending DM chunk for ${this.client.user.tag}: ${chunk}`);
          await message.author.send(chunk);
        }
        console.log(`All DM chunks sent for ${this.client.user.tag}.`);
      } catch (error) {
        console.error("Error sending DM:", error);
        await message.channel.send("I couldn't send you a DM. Please check your privacy settings and ensure you allow DMs from server members.");
      }
    }
  }

  start() {
    this.client.login(this.token);
  }

  // Method to update bot's name and emotion
  updatePersonality(newNickname, newEmotion) {
    this.nickname = newNickname;
    this.emotion = newEmotion;
    console.log(`Updated personality for ${this.client.user.tag}: Nickname - ${newNickname}, Emotion - ${newEmotion}`);
  }
}

// Function to create and start a new bot
function createBot(config) {
  if (config.token && config.nickname && config.emotion && config.serverId) {
    const bot = new AIBot(config);
    bot.start();
    console.log(`Started bot: ${config.nickname}`);
    return bot;
  } else {
    console.log(`Skipped creating bot due to missing configuration: ${config.nickname || 'Unnamed Bot'}`);
    return null;
  }
}

// Load bot configuration from environment variables
const botConfig = {
  token: process.env.BOT_TOKEN,
  nickname: process.env.BOT_NICKNAME || "AI Assistant",
  emotion: process.env.BOT_EMOTION || "a helpful AI assistant",
  serverId: process.env.BOT_SERVER_ID,
  prefix: process.env.BOT_PREFIX || '/'
};

// Create and start the bot
const activeBot = createBot(botConfig);

if (activeBot) {
  console.log("Bot is active and ready to use.");
  
  // Example of how to update the bot's personality later
  // This could be triggered by a command or an external event
  setTimeout(() => {
    activeBot.updatePersonality("New Bot Name", "a more enthusiastic AI assistant");
  }, 60000); // Update after 1 minute for demonstration
}
