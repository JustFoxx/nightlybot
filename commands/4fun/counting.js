const {MessageEmbed} = require("discord.js")
const db = require("quick.db")

module.exports = {
    name: "counting",
    run: async(client,message,args,pr,errorNull,errorPermissions) => {
        const channel = message.mentions.channels.first()

        if(!message.member.hasPermission("MANAGE_CHANNELS"))
            return message.channel.send(errorPermissions("ZARZĄDZANIE KANAŁAMI","MANAGE_CHANNELS"))
                .catch(err => console.log(err))

        if(!((args[0] || " ").toLowerCase() == "disable" || (args[0] || " ").toLowerCase() == "enable"))
            return message.channel.send(errorNull("counting", "<disable/enable>"))
                .catch(err => console.log(err))

        if((args[0] || " ").toLowerCase() == "disable") {
            db.set(`${message.guild.id}_switch_counting`,0)

            const embed = new MessageEmbed()
                .setTitle("Wyłączono liczenie!")
                .setColor("DARK_PURPLE")

            return message.channel.send(embed)
                .catch(err => console.log(err))
        }

        if(!channel)
            return message.channel.send(errorNull("counting", "enable <channel>"))

        db.set(`${message.guild.id}_counting`, channel.id)

        const embed = new MessageEmbed()
            .setTitle("Gotowe!")
            .setColor("DARK_PURPLE")

        message.channel.send(embed)
            .catch(err => console.log(err))

        db.set(`${message.guild.id}_switch_counting`,1)
        db.set(`${message.guild.id}_number`,0)
    }
}