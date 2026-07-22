const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

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

// Salons où la condition de publicité et de 100 caractères s'applique
const AD_CHANNELS = ['1529282315228811434', '1529282335227379815'];

// Gestion des erreurs globales pour éviter les crashs silencieux
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

    // 1. Système de vérification des salons de pub (100 caractères min + lien Discord obligatoire)
    if (AD_CHANNELS.includes(message.channel.id)) {
        // Laisse passer les administrateurs si besoin, ou retire cette ligne si ça s'applique à tout le monde
        if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

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

    // 2. Commande !support réservée aux administrateurs
    if (message.content === '!support') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({ content: "Vous n'avez pas la permission d'utiliser cette commande.", ephemeral: true });
        }

        // Vérifie si la commande est exécutée dans le bon salon
        if (message.channel.id !== CHANNEL_ID) {
            return message.reply({ content: `Cette commande doit être exécutée dans le salon <#${CHANNEL_ID}>.`, ephemeral: true });
        }

        // Supprime immédiatement le message pour éviter les envois en double
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

    // 1. Ouverture du ticket
    if (interaction.customId === 'open_ticket') {
        const guild = interaction.guild;
        const user = interaction.user;

        try {
            await interaction.deferReply({ ephemeral: true });

            // Crée le salon privé dans la catégorie définie
            const ticketChannel = await guild.channels.create({
                name: `ticket-${user.username}`,
                type: 0, // GuildText
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

    // 2. Fermeture du ticket
    if (interaction.customId === 'close_ticket') {
        try {
            await interaction.reply({ content: 'Fermeture du ticket en cours...', ephemeral: true });
            
            // Supprime le salon après un court délai
            setTimeout(async () => {
                await interaction.channel.delete().catch(() => {});
            }, 3000);
        } catch (error) {
            console.error('Erreur lors de la fermeture du ticket :', error);
        }
    }
});

// Connexion du bot en utilisant la variable d'environnement
client.login(process.env.DISCORD_TOKEN);
