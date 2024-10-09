import { Telegraf } from 'telegraf';
import instagram from 'instagram-url-direct';
import dotenv from 'dotenv';
import axios from 'axios';



dotenv.config();


const PORT = process.env.PORT || 3000

const bot = new Telegraf(process.env.BOT_TOKEN);
const channelUsername = process.env.CHANNEL_USERNAME || '@bot_by_isenpai9840';

const userStates = new Map(); // To track user task states

// Middleware to check if the user has joined the channel
const checkSubscription = async (ctx) => {
    try {
        const chatMember = await ctx.telegram.getChatMember(channelUsername, ctx.message.from.id);
        if (chatMember.status === 'member' || chatMember.status === 'administrator' || chatMember.status === 'creator') {
            return true;
        } else {
            await ctx.reply(`Please join our channel to use the bot:`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Join Channel', url: `https://t.me/${channelUsername.slice(1)}` }]
                    ]
                }
            });
            return false;
        }
    } catch (error) {
        console.error('Error checking subscription:', error);
        await ctx.reply('There was an error checking your subscription status. Please try again later.');
        return false;
    }
};

// Function to terminate current task
const terminateTask = (ctx) => {
    const userId = ctx.message.from.id;
    if (userStates.has(userId)) {
        userStates.delete(userId); // Remove the user from the task list
        return ctx.reply('Your task has been terminated.');
    }
    return ctx.reply('No active task to terminate.');
};

// Start command with subscription check
bot.start(async (ctx) => {
    const isSubscribed = await checkSubscription(ctx);
    if (isSubscribed) {
        await ctx.reply('Welcome! Please send me the Instagram reel link, and I will get the video for you.');
    }
});

// Listen for Instagram links and manage task state
bot.on('text', async (ctx) => {
    const isSubscribed = await checkSubscription(ctx);
    if (!isSubscribed) return;

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

            // Fetch the video using ===
            const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
            const videoBuffer = Buffer.from(videoResponse.data);

            // Send the video buffer as a file
            await ctx.replyWithVideo({ source: videoBuffer });

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

bot.launch().then(() => {
    console.log('Bot is up and running with Node.js');
});
