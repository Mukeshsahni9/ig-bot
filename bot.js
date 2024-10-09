import { Telegraf } from 'telegraf';
import instagram from 'instagram-url-direct';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

const userStates = new Map(); // To track user task states

// Function to terminate current task
const terminateTask = (ctx) => {
    const userId = ctx.message.from.id;
    if (userStates.has(userId)) {
        userStates.delete(userId); // Remove the user from the task list
        return ctx.reply('Your task has been terminated.');
    }
    return ctx.reply('No active task to terminate.');
};

// Start command
bot.start(async (ctx) => {
    await ctx.reply('Welcome! Please send me the Instagram reel link, and I will get the video for you.');
});

// Listen for Instagram links and manage task state
bot.on('text', async (ctx) => {
    const userId = ctx.message.from.id;

    // If the user already has an ongoing task
    if (userStates.has(userId)) {
        await ctx.reply('You already have a task in progress. Do you want to terminate it?', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Terminate Task', callback_data: 'terminate_task' }]
                ]
            }
        });
        return;
    }

    const messageText = ctx.message.text;
    if (messageText.includes('instagram.com')) {
        try {
            await ctx.reply('Processing your request, please wait...');

            // Mark this user as having an active task
            userStates.set(userId, true);

            const result = await instagram(messageText);
            const videoUrl = result.url_list[0];

            // Fetch the video using Axios
            const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
            const videoBuffer = Buffer.from(videoResponse.data);

            // Send the video buffer as a file
            await ctx.replyWithVideo({ source: videoBuffer });

            // Send the channel button message
            await ctx.reply('Join our channel for more useful bots:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Join Channel', url: `https://t.me/${process.env.CHANNEL_USERNAME.slice(1)}` }]
                    ]
                }
            });

            // Remove the user from the active task list once the task is done
            userStates.delete(userId);
        } catch (error) {
            await ctx.reply('Failed to fetch the video. Please make sure the link is correct and try again.');
            userStates.delete(userId); // Remove the task even if it failed
        }
    } else {
        await ctx.reply('Please send a valid Instagram link.');
    }
});

// Handle inline button clicks
bot.on('callback_query', async (ctx) => {
    const callbackData = ctx.callbackQuery.data;

    if (callbackData === 'terminate_task') {
        await terminateTask(ctx);
    }

    await ctx.answerCbQuery(); // Close the button prompt
});

// Set the webhook
const WEBHOOK_URL = `${process.env.RENDER_EXTERNAL_URL}/bot${process.env.BOT_TOKEN}`;
bot.telegram.setWebhook(WEBHOOK_URL);

// Start the bot with webhook
bot.startWebhook(`/bot${process.env.BOT_TOKEN}`, null, process.env.PORT || 3000);

console.log('Bot is running and ready to receive webhooks');
