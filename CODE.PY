import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Check for API key
if 'GOOGLE_API_KEY' not in os.environ:
    print("GOOGLE_API_KEY is not set in environment variables!")
    exit(1)

# Set the ID of the server you want the bot to work in
ALLOWED_SERVER_ID = 123456789  # Replace with your server's ID (as an integer)

# Set the AI's emotion/personality here
AI_EMOTION = "a helpful and friendly AI assistant"  # Change this to set the AI's emotion

# Set the bot's nickname here
BOT_NICKNAME = "AI Assistant"  # Change this to set the bot's nickname

# Initialize Discord client
intents = discord.Intents.default()
intents.message_content = True
intents.members = True  # Enable member intents
bot = commands.Bot(command_prefix='/', intents=intents)

# Initialize Google AI
genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))
model = genai.GenerativeModel('gemini-pro')

async def set_bot_nickname(guild, nickname):
    try:
        await guild.me.edit(nick=nickname)
        print(f'Set nickname to "{nickname}" in guild: {guild.name}')
    except Exception as error:
        print(f"Failed to set nickname in {guild.name}: {error}")

async def send_welcome_message(guild):
    if guild.id != ALLOWED_SERVER_ID:
        return
    
    print(f"Sending welcome message to allowed guild: {guild.name}")
    try:
        channel = next((ch for ch in guild.text_channels if ch.permissions_for(guild.me).send_messages), None)
        if channel:
            await channel.send("Hello, I'm your Swift AI. Type `/chat \"your question\"` to chat with me here, or `/dm \"your question\"` to receive a DM!")
            print(f"Welcome message sent to {channel.name} in {guild.name}")
        else:
            print(f"No suitable channel found in {guild.name}")
    except Exception as error:
        print(f"Error sending welcome message to {guild.name}: {error}")

@bot.event
async def on_ready():
    print(f'Logged in as {bot.user.name}')
    allowed_guild = discord.utils.get(bot.guilds, id=ALLOWED_SERVER_ID)
    if allowed_guild:
        await send_welcome_message(allowed_guild)
        await set_bot_nickname(allowed_guild, BOT_NICKNAME)
    else:
        print(f"Bot is not in the allowed server (ID: {ALLOWED_SERVER_ID})")

async def generate_ai_response(prompt):
    full_prompt = f"You are {AI_EMOTION}. Respond to: \"{prompt}\""
    print(f"Full Prompt: {full_prompt}")

    try:
        response = model.generate_content(full_prompt)
        text = response.text
        print(f"Generated text: {text}")

        if not text or len(text) < 5:
            return "I'm having trouble generating a response. Please try again later."

        return text
    except Exception as error:
        print(f"Error details: {error}")
        return f"An error occurred: {str(error)}"

@bot.command()
async def chat(ctx, *, user_prompt):
    if ctx.guild.id != ALLOWED_SERVER_ID:
        return

    print(f"Chat command detected. Prompt: {user_prompt}")
    response = await generate_ai_response(user_prompt)

    # Split the response into chunks of 2000 characters or less
    chunks = [response[i:i+2000] for i in range(0, len(response), 2000)]
    for chunk in chunks:
        print(f"Sending chunk: {chunk}")
        await ctx.send(chunk)
    print("All chunks sent.")

@bot.command()
async def dm(ctx, *, user_prompt):
    if ctx.guild.id != ALLOWED_SERVER_ID:
        return

    print(f"DM command detected. Prompt: {user_prompt}")
    response = await generate_ai_response(user_prompt)

    try:
        # Split the response into chunks of 2000 characters or less
        chunks = [response[i:i+2000] for i in range(0, len(response), 2000)]
        for chunk in chunks:
            print(f"Sending DM chunk: {chunk}")
            await ctx.author.send(chunk)
        print("All DM chunks sent.")
        await ctx.send("I've sent you a DM with my response!")
    except discord.Forbidden:
        await ctx.send("I couldn't send you a DM. Please check your privacy settings and ensure you allow DMs from server members.")

# Run the bot
bot.run(os.getenv('DISCORD_TOKEN'))
