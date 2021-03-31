const {Client, Collection, MessageEmbed} = require("discord.js")
const config = require("./config.json")
const db = require("quick.db")
const fs = require('fs')
const sleep = t => new Promise(r => setTimeout(r, t))

const client = new Client()

const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }

client.commands = new Collection()
client.aliases = new Collection()
client.categories = fs.readdirSync("./commands/");
["command"].forEach(handler => {
    fs.readdirSync("./commands/").forEach(dir => {
        const commands = fs.readdirSync(`./commands/${dir}/`).filter(file => file.endsWith(".js"))
        for (let file of commands) {
            let pull = require(`./commands/${dir}/${file}`)
            client.commands.set(pull.name, pull)
            if (pull.aliases && Array.isArray(pull.aliases)) pull.aliases.forEach(alias => client.aliases.set(alias, pull.name))
        }
    })
})

const errorPermissions = function (polish,english) {
    const embed = new MessageEmbed()
        .setTitle("Nie posiadasz permisji!")
        .setDescription(`Aby użyć komendy musisz posiadać permisje \`${polish}(${english})\``)
        .setColor("RED")
    return embed
}
const errorNull = function (command,arguments) {
    const embed = new MessageEmbed()
        .setTitle("Użyj poprawnie komendy!")
        .setDescription(`Użyj \`${command} ${arguments}\``)
        .setColor("RED")
    return embed
}
const errorBotPermissions = function (polish,english) {
    const embed = new MessageEmbed()
        .setTitle("Nie posiadam permisji!")
        .setDescription(`Aby użyć komendy musę posiadać permisje \`${polish}(${english})\``)
        .setColor("RED")
    return embed
}

function tags(text,member) {
    return text
        //guild
        .split("#guild.name#").join(member.guild.name)
        .split("#guild.members#").join(member.guild.memberCount)
        .split("#guild.icon#").join(member.guild.iconURL() || "")
        .split("#guild.createdAt#").join(member.guild.createdAt.toLocaleDateString("pl-PL",options))
        //member
        .split("#member.name#").join(member.user.name)
        .split("#member.mention#").join(member)
        .split("#member.tag#").join(member.user.tag)
        .split("#member.id#").join(member.user.id)
        .split("#member.name#").join(member.user.name)
        .split("#member.joinedAt#").join(member.joinedAt.toLocaleDateString("pl-PL",options))
        .split("#member.createdAt#").join(member.user.createdAt.toLocaleDateString("pl-PL",options))
        .split("#member.avatar#").join(member.user.displayAvatarURL())
}

client.on("message", async message => {
    if(!message.guild) return;
    prefix = db.get(`${message.guild.id}_prefix`) || "%'"
    if (!message.content.startsWith(prefix)) return
    if(message.author.bot) return
    if (!message.member) message.member = await message.guild.fetchMember(message)

    const args = message.content.slice(prefix.length).trim().split(' ')
    const cmd = args.shift().toLowerCase()

    if (cmd.length === 0) return;
    const comm = client.commands.get(cmd)
    let command = client.commands.get(cmd)
    if (!command) command = client.commands.get(client.aliases.get(cmd))
    if (command)
        command.run(client, message, args,prefix,errorNull,errorPermissions,tags,errorBotPermissions)
})

client.login(config.token)

try {
    client.on("guildMemberAdd", async member => {
        const obj = {
            muted: {
                time: {
                    date: undefined,
                    sec: undefined
                },
                check: undefined
            }
        }
        const { muted } = db.get(`${member.guild.id}_${member.id}_mute`) || obj
        if(!muted.check) return;
        const roleId = db.get(`${member.guild.id}_muted`) || {id: undefined}
        const role = member.guild.roles.cache.get(roleId.id)
        if(!role) return;
        if(!muted.time.sec)
            return member.roles.add(role)
        const dateNow = new Date().getTime() //czas teraz
        const dateMute = muted.time.date //czas wykonania mute
        const timeDiff = Math.abs(dateMute - dateNow)  //czas w którym użytkownika nie było na serwerze + czas mute przed wyjściem
        const timeDiffInSecond = Math.ceil(timeDiff / 1000) //zamienia w sekundy
        const allOfTime = muted.time.sec - timeDiffInSecond //oblicza ile musi trwać jeszcze mute, muted.time.sec(czas trwania mute) - timeDiffInSecound(czas w którym użytwkonika nie było na serwerze + czas mute przed wyjście)
        if(!allOfTime || allOfTime <= 0)
            return member.roles.remove(role)
        member.roles.add(role).catch(err => console.log(err))
        await sleep(allOfTime * 1000)
        member.roles.remove(role).catch(err => console.log(err))
    })
    client.on("ready", () => {
        console.log(` Zalogowano jako ${client.user.tag}\n`,
            `Serwery: ${client.guilds.cache.size}\n`,
            `Użytkownicy: ${client.users.cache.size}`)
        client.user.setStatus("idle")
    })

    client.on("guildCreate", () => {
        console.log(` Dodano bota na nowy serwer!\n`,
            `Serwery: ${client.guilds.cache.size}\n`,
            `Użytkownicy: ${client.users.cache.size}`)
    })

    client.on("guildMemberAdd", member => {
        const switched = db.get(`${member.guild.id}_switch_join`)
        if (switched != 1) return;
        const joined = db.get(`${member.guild.id}_join`)
        const text = tags(joined.text, member)
        member.guild.channels.cache.get(joined.id).send(text).catch(err => console.log(err))
    })


    client.on("message", msg => {
        if (!msg.guild) return;
        const switched = db.get(`${msg.guild.id}_switch_counting`)
        if (switched != 1) return;
        const countingChannel = db.get(`${msg.guild.id}_counting`)
        if (msg.channel.id != countingChannel) return;
        const nextNumber = db.get(`${msg.guild.id}_number`) + 1
        if (msg.content != nextNumber) {
            msg.delete().catch(err => console.log(err))
            return msg.author.send(`${msg.author}, Podałeś złą liczbe!`)
        }
        db.set(`${msg.guild.id}_number`, nextNumber)
    })

    client.on("channelCreate", channel => {
		if(!channel.guild) return;
        let role = db.get(`${channel.guild.id}_muted`) || {id: undefined}
        role = channel.guild.roles.cache.get(role.id)
        if(!role) return;
        channel.updateOverwrite(role, { SEND_MESSAGES: false })
    })
} catch (err) {
    console.log(err)
}
