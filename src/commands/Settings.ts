import { CommandInteraction, Client, ApplicationCommandType, ApplicationCommandOptionType, ChatInputCommandInteraction, EmbedBuilder, PermissionsBitField, InteractionReplyOptions } from 'discord.js';
import { Command } from "../InteractionInterface";
import { ChangeSettingResult, changeSetting, isGuildCommand } from "../Essentials";
import { generalError, noGuildError } from "../InteractionReplies";
import guildSchema, { GuildSettings } from '../models/guildSchema';
import Colors from '../Colors';
import { debug, error } from '../Log';

export const Settings: Command = {
    name: "settings",
    description: "View or the settings for this server",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "view",
            description: "View the settings for this server"
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "edit",
            description: "Edit a setting for this server",
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: "setting",
                    description: "The setting to change",
                    choices: [
                        {
                            name: "Quote List Page Size (number)",
                            value: "quoteListPageSize"
                        },
                        {
                            name: "Quote Search Date Tolerance (number)",
                            value: "quoteSearchDateTolerance"
                        }
                    ],
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.Number,
                    name: "number-value",
                    description: "The new value for the setting"
                }
            ]
        }
    ],
    run: async (client: Client, interaction: CommandInteraction) => {
        debug("Settings command called");

        if (!interaction.isChatInputCommand()) {
            await interaction.reply(generalError);
            return;
        }
        if (!isGuildCommand(interaction)) {
            await interaction.reply(noGuildError);
        }

        // Check if the user has permission to use this command
        const permissions = interaction.member!.permissions as PermissionsBitField;
        if (!permissions.has(PermissionsBitField.Flags.ManageGuild | PermissionsBitField.Flags.Administrator)) {
            await interaction.reply({
                content: "You do not have permission to use this command",
                ephemeral: true
            });
            return;
        }

        // Handle subcommands
        const subcommand = interaction.options.getSubcommand();
        let reply: InteractionReplyOptions;
        switch (subcommand) {
            case "view":
                reply = await handleView(interaction);
                break;
            case "edit":
                reply = await handleEdit(interaction);
                break;
            default:
                error(`Settings subcommand "${subcommand}" not found`);
                reply = generalError;
                break;
        }

        await interaction.reply(reply);
    }
}

// Subcommand handlers
/**
 * Display the settings for this guild
 * @param client
 * @param interaction
 */
const handleView = async (interaction: ChatInputCommandInteraction): Promise<InteractionReplyOptions> => {
    debug("Settings view subcommand called");

    if (!isGuildCommand(interaction)) {
        return noGuildError;
    }

    debug("Getting guild settings from database");
    const gSettings = await guildSchema.getGuildSettings(interaction.guildId!);
    
    // Create the embed
    const messageEmbed = new EmbedBuilder()
        .setTitle("Settings")
        .setTimestamp(Date.now())
        .setColor(Colors.settingsEmbed)

    debug("Adding settings fields to embed");
    let setting: keyof GuildSettings;
    for (setting in gSettings) {
        const type = typeof gSettings[setting]!.value;
        if (type === "number" || type === "string") {
            messageEmbed.addFields({
                name: gSettings[setting]!.name,
                value: `${gSettings[setting]!.value.toString()} ${gSettings[setting]!.unit ?? ""}`
            });
        } else if (type === "boolean") {
            messageEmbed.addFields({
                name: gSettings[setting]!.name,
                value: gSettings[setting]!.value ? "true" : "false"
            });
        } else if (setting === "quoteLinkedGuilds") {
            messageEmbed.addFields({
                name: gSettings[setting]!.name,
                value: "Use `/quoteLink list` to view linked guilds (WIP)"
            });
        } else {
            messageEmbed.addFields({
                name: gSettings[setting]!.name,
                value: "Unknown type"
            });
        }
    }

    // Send the embed
    return {
        embeds: [messageEmbed],
        ephemeral: true
    };
}

/**
 * Edit a setting for this guild
 * @param client 
 * @param interaction
 */
const handleEdit = async (interaction: ChatInputCommandInteraction): Promise<InteractionReplyOptions> => {
    debug("Settings edit subcommand called");

    if (!isGuildCommand(interaction)) {
        return noGuildError;
    }

    // Get the option values
    const setting = interaction.options.getString("setting", true);
    const numberValue = interaction.options.getNumber("number-value");

    // Change the setting if it exists
    const result = await changeSetting(interaction.guildId!, setting, numberValue);

    // Return the result
    switch (result) {
        case ChangeSettingResult.Changed_Number:
            return {
                content: "Updated setting " + setting + " to " + numberValue,
                ephemeral: true
            };
        case ChangeSettingResult.Missing_Number:
            return {
                content: "Please provide a number value",
                ephemeral: true
            };
        case ChangeSettingResult.Invalid_Setting:
            return {
                content: "Setting " + setting + " not found",
            }
        default:
            error(`ChangeSettingResult "${result}" not found`);
            return generalError;
    }
}