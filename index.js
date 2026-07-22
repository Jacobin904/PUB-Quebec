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

client.once('ready', () => {
    console.log(`Connecté en tant que ${client.user.tag} !`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Commande !support réservée aux administrateurs
    if (message.content === '!support') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({ content: "Vous n'avez pas la permission d'utiliser cette commande.", ephemeral: true });
        }

        // Vérifie si la commande est exécutée dans le bon salon
        if (message.channel.id !== CHANNEL_ID) {
            return message.reply({ content: `Cette commande doit être exécutée dans le salon <#${CHANNEL_ID}>.`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('🎫 Support - PUB Québec')
            .setDescription('Besoin d\'aide ou une question ? Cliquez sur le bouton ci-dessous pour ouvrir un ticket avec notre équipe.')
            .setColor(0x2b2d31);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_ticket')
                .setLabel('Ouvrir un ticket')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫')
        );

        // Supprime le message de la commande pour garder le salon propre
        await message.delete().catch(() => {});

        return message.channel.send({ embeds: [embed], components: [row] });
    }
});

// Gestionnaire de l'interaction du bouton pour créer le salon de ticket
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

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
                .setColor(0x00ae86);

            await ticketChannel.send({ content: `<@${user.id}> | <@&${STAFF_ROLE_ID}>`, embeds: [welcomeEmbed] });

            await interaction.editReply({ content: `Votre ticket a été créé avec succès : <#${ticketChannel.id}>` });
        } catch (error) {
            console.error('Erreur lors de la création du ticket :', error);
            await interaction.editReply({ content: 'Une erreur est survenue lors de la création de votre ticket.' });
        }
    }
});

// Connexion du bot en utilisant la variable d'environnement
client.login(process.env.DISCORD_TOKEN);
