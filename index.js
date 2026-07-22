const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const http = require('http');

// Petit serveur HTTP pour satisfaire Render et garder le bot actif
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Discord en ligne !\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur web en écoute sur le port ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ID des éléments spécifiés
const CHANNEL_ID = '1529282301891051620';
const CATEGORY_ID = '1529294134425423942';
const STAFF_ROLE_ID = '1529294257402151073';
const EMBED_COLOR = 0x2A13A8;

// IDs des catégories de salons de pub à surveiller
const AD_CATEGORIES = ['1529282315228811434', '1529282335227379815'];

client.on('error', (error) => {
    console.error('Erreur du client Discord :', error);
});

process.on('unhandledRejection', error => {
    console.error('Erreur non gérée (Promise Rejection) :', error);
});

client.once('ready', () => {
    console.log(`Connecté en tant que ${client.user.tag} !`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // 1. Système de vérification si le message est dans un salon appartenant à l'une des catégories de pub
    if (message.channel.parentId && AD_CATEGORIES.includes(message.channel.parentId)) {
        const hasDiscordInvite = /(discord\.(gg|com\/invite)\/[a-zA-Z0-9]+)/i.test(message.content);
        const isLongEnough = message.content.length >= 100;

        if (!isLongEnough || !hasDiscordInvite) {
            await message.delete().catch(() => {});
            
            let reason = [];
            if (!isLongEnough) reason.push('faire au moins 100 caractères');
            if (!hasDiscordInvite) reason.push('contenir une invitation Discord valide');

            try {
                await message.author.send(`⚠️ Ton message dans le salon <#${message.channel.id}> a été supprimé car il ne respecte pas les règles de publicité :\n- Il doit ${reason.join(' et ')}.`);
            } catch (err) {
                // Ignore si les DM sont fermés
            }
            return;
        }
    }

    // 2. Commande !support
    if (message.content === '!support') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({ content: "Vous n'avez pas la permission d'utiliser cette commande.", ephemeral: true });
        }

        if (message.channel.id !== CHANNEL_ID) {
            return message.reply({ content: `Cette commande doit être exécutée dans le salon <#${CHANNEL_ID}>.`, ephemeral: true });
        }

        await message.delete().catch(() => {});

        const embed = new EmbedBuilder()
            .setTitle('🎫 Support - PUB Québec')
            .setDescription('Besoin d\'aide ou une question ? Cliquez sur le bouton ci-dessous pour ouvrir un ticket avec notre équipe.')
            .setColor(EMBED_COLOR);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_ticket')
                .setLabel('Ouvrir un ticket')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫')
        );

        return message.channel.send({ embeds: [embed], components: [row] });
    }
});

// Gestionnaire des interactions des boutons
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
                parent: CATEGORY_ID,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                    },
                    {
                        id: STAFF_ROLE_ID,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                    },
                ],
            });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`Ticket de ${user.username}`)
                .setDescription('Un membre de l\'équipe du staff va vous prendre en charge rapidement.\nDécrivez votre problème ci-dessous.')
                .setColor(EMBED_COLOR);

            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Fermer le ticket')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            );

            await ticketChannel.send({ 
                content: `<@${user.id}> | <@&${STAFF_ROLE_ID}>`, 
                embeds: [welcomeEmbed], 
                components: [closeRow] 
            });

            await interaction.editReply({ content: `Votre ticket a été créé avec succès : <#${ticketChannel.id}>` });
        } catch (error) {
            console.error('Erreur lors de la création du ticket :', error);
            await interaction.editReply({ content: 'Une erreur est survenue lors de la création de votre ticket.' });
        }
    }

    if (interaction.customId === 'close_ticket') {
        try {
            await interaction.reply({ content: 'Fermeture du ticket en cours...', ephemeral: true });
            setTimeout(async () => {
                await interaction.channel.delete().catch(() => {});
            }, 3000);
        } catch (error) {
            console.error('Erreur lors de la fermeture du ticket :', error);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
