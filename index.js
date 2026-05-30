const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection,
  entersState,
  StreamType,
} = require('@discordjs/voice');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const player = createAudioPlayer();

let queue = [
  {
    title: "Doki Doki Literature Club!",
    url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/izzackus/1-01.%20Doki%20Doki%20Literature%20Club%21.mp3",
    image: "https://i.imgur.com/YIo0QKZ.jpeg",
  },
  {
    title: "Ohayou Sayori!",
    url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/fyaipyad/1-02.%20Ohayou%20Sayori%21.mp3",
    image: "https://i.imgur.com/YIo0QKZ.jpeg",
  },
  {
    title: "Dreams of Love and Literature",
    url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/sbdpmsbc/1-03.%20Dreams%20of%20Love%20and%20Literature.mp3",
    image: "https://i.imgur.com/YIo0QKZ.jpeg",
  },
];

let currentSongIndex = 0;
let connection = null;

// Returns a promise that resolves once the connection is ready
async function getOrCreateConnection(channel) {
  const existing = getVoiceConnection(channel.guild.id);

  if (existing) {
    console.log(`[VOICE] Reusing existing connection — status: ${existing.state.status}`);
    // If it's already ready, return it immediately
    if (existing.state.status === VoiceConnectionStatus.Ready) {
      return existing;
    }
    // Otherwise wait for it to become ready
    console.log(`[VOICE] Waiting for existing connection to become Ready...`);
    await entersState(existing, VoiceConnectionStatus.Ready, 10_000);
    console.log(`[VOICE] Existing connection is now Ready`);
    return existing;
  }

  console.log(`[VOICE] Joining channel: ${channel.name} (${channel.id}) in guild: ${channel.guild.name}`);

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
  });

  connection.subscribe(player);
  console.log(`[VOICE] Player subscribed to connection`);

  connection.on('error', (error) => {
    console.error(`[VOICE ERROR] ${error.message}`);
  });

  connection.on('stateChange', (oldState, newState) => {
    console.log(`[VOICE STATE] ${oldState.status} → ${newState.status}`);
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    console.warn(`[VOICE] Disconnected — attempting to reconnect for 5s...`);
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
      console.log(`[VOICE] Reconnected successfully`);
    } catch {
      console.error(`[VOICE] Could not reconnect — destroying connection`);
      connection.destroy();
      connection = null;
    }
  });

  // Wait until fully ready before returning
  console.log(`[VOICE] Waiting for connection to become Ready...`);
  await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
  console.log(`[VOICE] Connection is Ready`);

  return connection;
}

async function playSong(channel) {
  const song = queue[currentSongIndex];
  console.log(`[PLAYER] Attempting to play [${currentSongIndex}]: "${song.title}"`);
  console.log(`[PLAYER] URL: ${song.url}`);

  try {
    await getOrCreateConnection(channel);
  } catch (err) {
    console.error(`[PLAYER] Failed to get voice connection: ${err.message}`);
    return;
  }

  console.log(`[PLAYER] Creating audio resource...`);
  const resource = createAudioResource(song.url, {
    inputType: StreamType.Arbitrary,
  });

  console.log(`[PLAYER] Calling player.play()...`);
  player.play(resource);
  console.log(`[PLAYER] player.play() called — player status: ${player.state.status}`);
}

// Log all player state transitions
player.on('stateChange', (oldState, newState) => {
  console.log(`[PLAYER STATE] ${oldState.status} → ${newState.status}`);
});

player.on(AudioPlayerStatus.Playing, () => {
  console.log(`[PLAYER] ✅ Now playing: "${queue[currentSongIndex].title}"`);
});

player.on(AudioPlayerStatus.Buffering, () => {
  console.log(`[PLAYER] Buffering...`);
});

player.on(AudioPlayerStatus.Idle, () => {
  console.log(`[PLAYER] Track finished. Advancing to next song...`);
  currentSongIndex = (currentSongIndex + 1) % queue.length;

  // Use the existing connection's channel — no need to re-join
  const conn = connection ?? getVoiceConnection(client.guilds.cache.first()?.id);
  const channel = client.guilds.cache.first()?.members?.me?.voice?.channel;

  if (!channel) {
    console.warn(`[PLAYER] Bot is not in a voice channel — cannot auto-advance`);
    return;
  }

  console.log(`[PLAYER] Auto-advancing to [${currentSongIndex}]: "${queue[currentSongIndex].title}"`);
  playSong(channel);
});

player.on('error', (error) => {
  console.error(`[PLAYER ERROR] ${error.message}`);
});

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;

  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const voiceChannel = message.member.voice.channel;

  console.log(`[CMD] "${command}" from ${message.author.tag} in #${message.channel.name}`);

  if (['!play', '!skip', '!stop'].includes(command) && !voiceChannel) {
    console.warn(`[CMD] ${message.author.tag} is not in a voice channel`);
    return message.reply('Bir ses kanalında olmalısın!');
  }

  if (command === '!play') {
    console.log(`[CMD] !play — starting from index 0`);
    currentSongIndex = 0;
    await playSong(voiceChannel);
    message.channel.send(`🎵 Çalıyor: **${queue[currentSongIndex].title}**`);
  }

  if (command === '!skip') {
    const prevIndex = currentSongIndex;
    currentSongIndex = (currentSongIndex + 1) % queue.length;
    console.log(`[CMD] !skip — ${prevIndex} → ${currentSongIndex}: "${queue[currentSongIndex].title}"`);
    await playSong(voiceChannel);
    message.channel.send(`⏭️ Skip → **${queue[currentSongIndex].title}**`);
  }

  if (command === '!stop') {
    console.log(`[CMD] !stop — stopping player and destroying connection`);
    player.stop();
    const conn = getVoiceConnection(message.guild.id);
    if (conn) {
      conn.destroy();
      console.log(`[VOICE] Connection destroyed`);
    }
    connection = null;
    message.channel.send('⏹️ Durduruldu');
  }

  if (command === '!queue') {
    const list = queue
      .map((s, i) => (i === currentSongIndex ? `▶ ${s.title}` : `${i + 1}. ${s.title}`))
      .join('\n');
    const embed = new EmbedBuilder()
      .setTitle('🎶 Queue')
      .setDescription(list)
      .setColor('#CCEBFF');
    message.channel.send({ embeds: [embed] });
  }

  if (command === '!debug') {
    const conn = getVoiceConnection(message.guild.id);
    const info = [
      `**Player status:** ${player.state.status}`,
      `**Connection status:** ${conn ? conn.state.status : 'not connected'}`,
      `**Current song index:** ${currentSongIndex}`,
      `**Current song:** ${queue[currentSongIndex].title}`,
      `**Bot voice channel:** ${message.guild.members.me?.voice?.channel?.name ?? 'none'}`,
    ].join('\n');
    message.channel.send(info);
  }
});

client.once('clientReady', () => {
  console.log(`[BOT] Ready: ${client.user.tag}`);
  console.log(`[BOT] Serving ${client.guilds.cache.size} guild(s)`);
});

client.login(process.env.TOKEN);
