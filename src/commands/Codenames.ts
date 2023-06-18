import { CommandInteraction, Client, ApplicationCommandType, ApplicationCommandOptionType, ChatInputCommandInteraction, InteractionReplyOptions, GuildMember, AttachmentBuilder } from "discord.js";
import { Command } from "../InteractionInterface";
import { generalError, noGuildError } from "../InteractionReplies";
import { isGuildCommand } from "../Essentials";
import codenamesSchema from "../models/codenamesSchema";
import guildMemberSchema from "../models/guildMemberSchema";
import { debug, error } from '../Log';

export const Codenames: Command = {
    name: "codenames",
    description: "Add words to the server wordpack",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "add-word",
            description: "Add a word to the server wordpack",
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: "word",
                    description: "The word to add",
                    required: true,
                }
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "wordpack",
            description: "Get the server wordpack",
        }
    ],
    run: async (client: Client, interaction: CommandInteraction) => {
        debug("Codenames command called");

        if (!interaction.isChatInputCommand()) {
            await interaction.reply(generalError);
            return;
        }
        if (!isGuildCommand(interaction)) {
            await interaction.reply(noGuildError);
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        let reply: InteractionReplyOptions;
        switch (subcommand) {
            case "add-word":
                reply = await handleAddWord(interaction);
                break;
            case "wordpack":
                reply = await handleGetPack(interaction);
                break;
            default:
                reply = generalError;
                break;
        }

        await interaction.reply(reply);
    }
}

// Subcommand handlers
/**
 * Create a new game of quote guesser
 * @param interaction
 */
const handleAddWord = async (interaction: ChatInputCommandInteraction): Promise<InteractionReplyOptions> => {
    debug("Codenames add-word subcommand called");
    
    if (!isGuildCommand(interaction)) {
        return noGuildError;
    }

    // Get the options
    const word = interaction.options.getString("word", true);

    // Update the creator's names in the database
    const creatorMember = interaction.member as GuildMember;
    const creatorDocument = await guildMemberSchema.updateNames(interaction.guildId!, interaction.user.id, interaction.user.username, creatorMember.displayName, interaction.user.discriminator);

    // Create the codenames word
    try {
        const codenamesDocument = await codenamesSchema.create({
            guildId: interaction.guildId,
            word: word,
            creator: creatorDocument._id,
        });
    } catch (error: any) {
        if (error.code === 11000) {
            return {
                content: `The word "${word}" is already in the server wordpack`,
                ephemeral: true,
            };
        } else {
            error(error);
        }
    }

    return {
        content: `Added the word "${word}" to the server wordpack`,
        ephemeral: true,
    };
}

/**
 * Display the leaderboard for quote guesser
 * @param interaction
 */
const handleGetPack = async (interaction: ChatInputCommandInteraction): Promise<InteractionReplyOptions> => {
    debug("Codenames wordpack subcommand called");

    if (!isGuildCommand(interaction)) {
        return noGuildError;
    }

    const words = await codenamesSchema.listQuotes(interaction.guildId!);
    const buffer = Buffer.from(words.join("\n"), "utf-8");

    return{
        files: [{
            attachment: buffer,
            name: "wordpack.txt",
        }],
        ephemeral: true,
    };
}
