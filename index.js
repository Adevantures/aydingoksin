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

function connectToVoice(channel) {
  const existing = getVoiceConnection(channel.guild.id);
  if (existing) {
    console.log(`[VOICE] Reusing existing connection in guild ${channel.guild.id}`);
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

  return connection;
}

function playSong(channel) {
  const song = queue[currentSongIndex];
  console.log(`[PLAYER] Attempting to play [${currentSongIndex}]: "${song.title}"`);
  console.log(`[PLAYER] URL: ${song.url}`);

  const conn = connectToVoice(channel);
  console.log(`[PLAYER] Connection status: ${conn.state.status}`);

  const startPlaying = () => {
    console.log(`[PLAYER] Creating audio resource...`);
    const resource = createAudioResource(song.url, {
      inputType: StreamType.Arbitrary,
    });
    console.log(`[PLAYER] Resource created, calling player.play()...`);
    player.play(resource);
    console.log(`[PLAYER] player.play() called — player status: ${player.state.status}`);
  };

  if (conn.state.status === VoiceConnectionStatus.Ready) {
    console.log(`[PLAYER] Connection already ready, starting immediately`);
    startPlaying();
  } else {
    console.log(`[PLAYER] Connection not ready yet, waiting for Ready event...`);
    conn.once(VoiceConnectionStatus.Ready, () => {
      console.log(`[PLAYER] Connection became Ready — starting playback`);
      startPlaying();
    });
  }
}

// Log all player state transitions
player.on('stateChange', (oldState, newState) => {
  console.log(`[PLAYER STATE] ${oldState.status} → ${newState.status}`);
});

player.on(AudioPlayerStatus.Playing, () => {
  console.log(`[PLAYER] ✅ Now playing: "${queue[currentSongIndex].title}"`);
});

player.on(AudioPlayerStatus.Idle, () => {
  console.log(`[PLAYER] Track finished or idle. Advancing to next song...`);
  currentSongIndex = (currentSongIndex + 1) % queue.length;
  const guild = client.guilds.cache.first();
  const channel = guild?.members.me?.voice?.channel;
  if (channel) {
    console.log(`[PLAYER] Auto-advancing to [${currentSongIndex}]: "${queue[currentSongIndex].title}"`);
    playSong(channel);
  } else {
    console.warn(`[PLAYER] Bot is not in a voice channel — skipping auto-advance`);
  }
});

player.on(AudioPlayerStatus.Buffering, () => {
  console.log(`[PLAYER] Buffering...`);
});

player.on(AudioPlayerStatus.Paused, () => {
  console.log(`[PLAYER] Paused`);
});

player.on('error', (error) => {
  console.error(`[PLAYER ERROR] ${error.message}`);
  console.error(`[PLAYER ERROR] Resource URL: ${error.resource?.metadata?.url ?? 'unknown'}`);
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
    console.log(`[CMD] !play — resetting to index 0`);
    currentSongIndex = 0;
    playSong(voiceChannel);
    message.channel.send(`🎵 Çalıyor: **${queue[currentSongIndex].title}**`);
  }

  if (command === '!skip') {
    const prevIndex = currentSongIndex;
    currentSongIndex = (currentSongIndex + 1) % queue.length;
    console.log(`[CMD] !skip — ${prevIndex} → ${currentSongIndex}: "${queue[currentSongIndex].title}"`);
    playSong(voiceChannel);
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
