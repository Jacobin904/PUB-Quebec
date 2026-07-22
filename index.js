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

    // 1. Commande !id pour lister les salons et les rôles
    if (message.content === '!id') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({ content: "Vous n'avez pas la permission d'utiliser cette commande.", ephemeral: true });
        }

        await message.delete().catch(() => {});

        const guild = message.guild;

        // Récupère tous les salons
        const channels = guild.channels.cache.map(c => `• **${c.name}** : \`${c.id}\``).join('\n') || 'Aucun salon';
        
        // Récupère tous les rôles
        const roles = guild.roles.cache.map(r => `• **${r.name}** : \`${r.id}\``).join('\n') || 'Aucun rôle';

        // Envoi par message privé (DM) pour éviter de spammer le salon car la liste peut être longue
        try {
            const embedChannels = new EmbedBuilder()
                .setTitle('📋 Liste des Salons - PUB Québec')
                .setDescription(channels.length > 4096 ? channels.substring(0, 4093) + '...' : channels)
                .setColor(EMBED_COLOR);

            const embedRoles = new EmbedBuilder()
                .setTitle('🔑 Liste des Rôles - PUB Québec')
                .setDescription(roles.length > 4096 ? roles.substring(0, 4093) + '...' : roles)
                .setColor(EMBED_COLOR);

            await message.author.send({ embeds: [embedChannels, embedRoles] });
            return message.channel.send({ content: "Les listes des ID des salons et rôles vous ont été envoyées en message privé !", ephemeral: true }).then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 5000);
            });
        } catch (err) {
            return message.reply({ content: "Impossible de vous envoyer un message privé. Veuillez ouvrir vos DM.", ephemeral: true });
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
