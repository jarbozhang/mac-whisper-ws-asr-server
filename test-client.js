#!/usr/bin/env node
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

// 测试配置
const WS_URL = 'ws://localhost:8765/ws';
const AUTH_TOKEN = 'test_token_123';

// 生成 1 秒的静音 PCM 数据 (16kHz, 16-bit, mono)
function generateSilentPCM(durationSec = 1) {
  const sampleRate = 16000;
  const channels = 1;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const totalSamples = sampleRate * channels * durationSec;
  const totalBytes = totalSamples * bytesPerSample;

  // 创建静音数据（全0）
  return Buffer.alloc(totalBytes);
}

// 测试 WebSocket 连接
function testWebSocket() {
  console.log('🔌 连接到 WebSocket 服务器:', WS_URL);

  const ws = new WebSocket(WS_URL);
  const reqId = uuidv4();

  ws.on('open', () => {
    console.log('✅ WebSocket 连接成功');

    // 1. 发送 start 消息
    const startMsg = {
      type: 'start',
      token: AUTH_TOKEN,
      reqId: reqId,
      mode: 'return_only',
      format: 'pcm_s16le',
      sampleRate: 16000,
      channels: 1,
      bitDepth: 16
    };

    console.log('📤 发送 start 消息:', { type: startMsg.type, reqId });
    ws.send(JSON.stringify(startMsg));
  });

  ws.on('message', (data, isBinary) => {
    if (!isBinary) {
      const msg = JSON.parse(data.toString('utf8'));
      console.log('📥 收到消息:', msg);

      if (msg.type === 'ack' && msg.status === 'ready') {
        console.log('📤 发送音频数据...');

        // 2. 发送静音 PCM 数据 (1秒)
        const pcmData = generateSilentPCM(1);
        ws.send(pcmData);

        console.log(`   已发送 ${pcmData.length} 字节 PCM 数据`);

        // 3. 发送 end 消息
        setTimeout(() => {
          const endMsg = {
            type: 'end',
            reqId: reqId
          };

          console.log('📤 发送 end 消息');
          ws.send(JSON.stringify(endMsg));
        }, 100);
      }

      if (msg.type === 'result') {
        console.log('✨ ASR 识别结果:', msg.text);
        console.log(`   耗时: ${msg.ms}ms`);
        console.log('✅ 测试完成');
        ws.close();
      }

      if (msg.type === 'error') {
        console.error('❌ 错误:', msg.message);
        ws.close();
      }
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket 错误:', error.message);
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket 连接已关闭');
  });
}

// 测试取消功能
function testCancel() {
  console.log('\n🔌 测试取消功能...');

  const ws = new WebSocket(WS_URL);
  const reqId = uuidv4();

  ws.on('open', () => {
    console.log('✅ WebSocket 连接成功');

    const startMsg = {
      type: 'start',
      token: AUTH_TOKEN,
      reqId: reqId,
      mode: 'return_only'
    };

    console.log('📤 发送 start 消息');
    ws.send(JSON.stringify(startMsg));
  });

  ws.on('message', (data, isBinary) => {
    if (!isBinary) {
      const msg = JSON.parse(data.toString('utf8'));
      console.log('📥 收到消息:', msg);

      if (msg.type === 'ack' && msg.status === 'ready') {
        // 发送一些数据后取消
        const pcmData = generateSilentPCM(0.5);
        ws.send(pcmData);

        setTimeout(() => {
          const cancelMsg = {
            type: 'cancel',
            reqId: reqId
          };

          console.log('📤 发送 cancel 消息');
          ws.send(JSON.stringify(cancelMsg));
        }, 50);
      }

      if (msg.type === 'ack' && msg.status === 'cancelled') {
        console.log('✅ 取消成功');
        ws.close();
      }
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket 错误:', error.message);
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket 连接已关闭\n');
  });
}

// 测试认证失败
function testAuthFailure() {
  console.log('\n🔌 测试认证失败...');

  const ws = new WebSocket(WS_URL);
  const reqId = uuidv4();

  ws.on('open', () => {
    console.log('✅ WebSocket 连接成功');

    const startMsg = {
      type: 'start',
      token: 'wrong_token',  // 错误的 token
      reqId: reqId
    };

    console.log('📤 发送 start 消息（使用错误的 token）');
    ws.send(JSON.stringify(startMsg));
  });

  ws.on('message', (data, isBinary) => {
    if (!isBinary) {
      const msg = JSON.parse(data.toString('utf8'));
      console.log('📥 收到消息:', msg);

      if (msg.type === 'error' && msg.message === 'unauthorized') {
        console.log('✅ 认证失败测试通过');
      }
    }
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket 连接已关闭（预期行为）\n');
  });
}

// 运行测试
console.log('=== WebSocket ASR 服务器测试 ===\n');

const args = process.argv.slice(2);
if (args.includes('--all')) {
  // 运行所有测试
  testWebSocket();
  setTimeout(() => testCancel(), 3000);
  setTimeout(() => testAuthFailure(), 6000);
} else if (args.includes('--cancel')) {
  testCancel();
} else if (args.includes('--auth')) {
  testAuthFailure();
} else {
  // 默认运行基本测试
  testWebSocket();
}
