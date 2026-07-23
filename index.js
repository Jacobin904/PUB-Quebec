require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const cors = require('cors');

// ==========================================
// 1. CONFIGURATION DU SERVEUR WEB (API)
// ==========================================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ status: 'online', message: 'API PUB Québec est active' });
});

app.get('/api/status', (req, res) => {
    res.json({
        online: client.isReady(),
        ping: client.ws.ping,
        uptime: formatUptime(client.uptime)
    });
});

app.get('/api/guild', (req, res) => {
    const guild = client.guilds.cache.first();
    if (!guild) return res.status(500).json({ error: 'Guild not found' });

    res.json({
        name: guild.name,
        memberCount: guild.memberCount,
        iconURL: guild.iconURL({ size: 1024 }),
        inviteLink: 'https://discord.gg/SX9XqGAMFy'
    });
});

app.listen(PORT, () => {
    console.log(`[WEB] Serveur API en écoute sur le port ${PORT}`);
});

// ==========================================
// 2. CONFIGURATION DU BOT DISCORD
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const CONFIG = {
    CHANNEL_ID: '1529282301891051620',
    CATEGORY_ID: '1529294134425423942',
    STAFF_ROLE_ID: '1529294257402151073',
    EMBED_COLOR: 0x2A13A8,
    AD_CATEGORIES: ['1529282315228811434', '1529282335227379815'],
    BOOSTER_INFO_CHANNEL_ID: '1529505071224852621'
};

client.on('error', (error) => console.error('[BOT] Erreur client Discord :', error));
process.on('unhandledRejection', error => console.error('[BOT] Promesse rejetée :', error));

client.once('ready', () => {
    console.log(`[BOT] Connecté en tant que ${client.user.tag}`);
});

// ==========================================
// 3. LOGIQUE DU BOT
// ==========================================

client.on('guildMemberRemove', async (member) => {
    try {
        const guild = member.guild;
        const pubChannels = guild.channels.cache.filter(c => c.type === 0 && c.parentId && CONFIG.AD_CATEGORIES.includes(c.parentId));

        for (const [channelId, channel] of pubChannels) {
            try {
                const messages = await channel.messages.fetch({ limit: 100 });
                const userMessages = messages.filter(msg => msg.author.id === member.id);

                if (userMessages.size > 0) {
                    await channel.bulkDelete(userMessages, true).catch(() => {
                        userMessages.forEach(msg => msg.delete().catch(() => {}));
                    });
                }
            } catch (err) {
                console.error(`[BOT] Erreur lors du nettoyage dans le salon ${channel.name}:`, err);
            }
        }
    } catch (error) {
        console.error('[BOT] Erreur lors du traitement du départ d\'un membre :', error);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // Gestion du salon d'information Booster
    if (message.channel.id === CONFIG.BOOSTER_INFO_CHANNEL_ID) {
        const boosterContent = `__## **Avantages Booster**__

* Salon ou un bot envoie ta pub
* Rôle personnalisé (Doit être accepté par le staff)
* Accès à un salon textuel et vocal exclusif réservé aux soutiens du serveur :lock:
* Possibilité d'ajouter un émoji personnalisé de ton choix sur le serveur :sparkles:
* Immunité contre certains ralentissements (*slowmode*) dans les salons textuels :zap:
* Double de chances lors de nos *giveaways* et concours organisés sur le serveur :gift:
* Acces au soundBoard :loud_sound:
`;

        try {
            // NOTE : On NE touche PAS à ton message (pas de message.delete ici)

            // Récupère les messages récents et filtre *uniquement* les messages du bot
            const messages = await message.channel.messages.fetch({ limit: 20 });
            const botMessages = messages.filter(msg => msg.author.id === client.user.id);

            // Supprime uniquement les anciens messages du bot
            for (const [, botMsg] of botMessages) {
                await botMsg.delete().catch(() => {});
            }

            // Envoie le nouveau message unique du bot
            await message.channel.send({ content: boosterContent });
        } catch (err) {
            console.error('[BOT] Erreur lors de la gestion du salon booster :', err);
        }
        return;
    }

    // 1. Vérification des règles de publicité
    if (message.channel.parentId && CONFIG.AD_CATEGORIES.includes(message.channel.parentId)) {
        const hasDiscordInvite = /(discord\.(gg|com\/invite)\/[a-zA-Z0-9]+)/i.test(message.content);
        const isLongEnough = message.content.length >= 100;

        if (!isLongEnough || !hasDiscordInvite) {
            await message.delete().catch(() => {});
            
            let reason = [];
            if (!isLongEnough) reason.push('faire au moins 100 caractères');
            if (!hasDiscordInvite) reason.push('contenir une invitation Discord valide');

            try {
                await message.author.send(`⚠️ Ton message dans <#${message.channel.id}> a été supprimé.\nRaison : Il doit ${reason.join(' et ')}.`);
            } catch (err) {
                // DM fermés, on ignore
            }
            return;
        }
    }

    // 2. Commande !support
    if (message.content === '!support') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({ content: "Permission refusée.", ephemeral: true });
        }

        if (message.channel.id !== CONFIG.CHANNEL_ID) {
            return message.reply({ content: `Commande réservée au salon <#${CONFIG.CHANNEL_ID}>.`, ephemeral: true });
        }

        await message.delete().catch(() => {});

        const embed = new EmbedBuilder()
            .setTitle('🎫 Support - PUB Québec')
            .setDescription('Besoin d\'aide ? Cliquez sur le bouton ci-dessous pour ouvrir un ticket avec notre équipe.')
            .setColor(CONFIG.EMBED_COLOR);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_ticket')
                .setLabel('Ouvrir un ticket')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫')
        );

        message.channel.send({ embeds: [embed], components: [row] });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'open_ticket') {
        const guild = interaction.guild;
        const user = interaction.user;

        try {
            await interaction.deferReply({ ephemeral: true });

            const ticketChannel = await guild.channels.create({
                name: `ticket-${user.username}`,
                type: 0,
                parent: CONFIG.CATEGORY_ID,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: CONFIG.STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                ],
            });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`Ticket de ${user.username}`)
                .setDescription('Un membre du staff va vous prendre en charge rapidement.\nDécrivez votre problème ci-dessous.')
                .setColor(CONFIG.EMBED_COLOR);

            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Fermer le ticket')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            );

            await ticketChannel.send({ 
                content: `<@${user.id}> | <@&${CONFIG.STAFF_ROLE_ID}>`, 
                embeds: [welcomeEmbed], 
                components: [closeRow] 
            });

            await interaction.editReply({ content: `✅ Ticket créé : <#${ticketChannel.id}>` });
        } catch (error) {
            console.error('[BOT] Erreur création ticket :', error);
            await interaction.editReply({ content: '❌ Erreur lors de la création du ticket.' });
        }
    }

    if (interaction.customId === 'close_ticket') {
        try {
            await interaction.reply({ content: 'Fermeture dans 3 secondes...', ephemeral: true });
            setTimeout(async () => {
                await interaction.channel.delete().catch(() => {});
            }, 3000);
        } catch (error) {
            console.error('[BOT] Erreur fermeture ticket :', error);
        }
    }
});

function formatUptime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    return `${days}j ${hours}h ${minutes}m ${seconds}s`;
}

client.login(process.env.DISCORD_TOKEN);
