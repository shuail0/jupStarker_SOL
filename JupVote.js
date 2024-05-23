const Logger = require("@youpaichris/logger");
const fs = require("fs");
const path = require("path");
const logger = new Logger();
const { Wallet } = require('@project-serum/anchor');
const dotenv = require("dotenv");
dotenv.config();
const { Connection, Keypair } = require('@solana/web3.js');
const Worker = require("./src/worker.js");
const { getSPLBalance } = require("./src/spl.js");
const bs58 = require('bs58');
const readlineSync = require('readline-sync');
const { appendObjectToCSV, sleep, decryptUsingAESGCM, convertCSVToObjectSync } = require('./src/utils.js');

const logsPath = path.join(__dirname, 'logs');

// 如果logs文件夹不存在则创建
if (!fs.existsSync(logsPath)) {
  fs.mkdirSync(logsPath);
}

const successPath = path.join(logsPath, 'VoteSuccess.csv');
const errorPath = path.join(logsPath, 'VoteError.csv');


// __________________________下面是需要修改的参数________________________________________________________
let rpc = ""; // RPC，到https://www.helius.dev/注册获取
const wallet_path = ''; // 钱包文件路径
const proposalId = 'GiPupbvjySF8XQr7NPk8z3HhLkkreuZ7pdDqcyaSWMXN' // 要投票的提案 ID
const voteId = 1 // 根据实际情况修改 voteId
const CONCURRENCY = 5; // 线程数
// __________________________________________________________________________________

const pwd = readlineSync.question('Please enter your password: ', {
  hideEchoBack: true // 密码不回显
});
const walletData = convertCSVToObjectSync(wallet_path);

async function processWallet(wt, ...args) {


  const privateKey = decryptUsingAESGCM(wt.a, wt.e, wt.i, wt.s, pwd)
  const connection = new Connection(rpc);
  const wallet = new Wallet(Keypair.fromSecretKey(bs58.decode(privateKey)));
  let p = new Worker('1', rpc, privateKey); // 请根据实际情况替换worker的实例化方式
  let date;
  // 查询SOL余额
  const SOLBalance = await connection.getBalance(wallet.publicKey);
  logger.info('wallet address:', wt.Address, 'SOLBalance:', SOLBalance);
  if (SOLBalance < 0.0003 * 10 ** 9) {
    logger.error(`钱包:${wt.Address}余额不足, SOL余额:${SOLBalance}`);
    date = new Date().toLocaleString();
    await appendObjectToCSV({ date, ...wt, Error: `余额不足,SOL余额:${SOLBalance}` }, errorPath);
  }
  const MAX_RETRY = 100;
  let num = 0;

  while (num < MAX_RETRY) {
    try {
      const txid = await p.vote(proposalId, voteId);
      if (txid) {
        logger.success(`交易成功:https://solscan.io/tx/${txid}`);
        // 获取当前本地时间
        date = new Date().toLocaleString();
        await appendObjectToCSV({ date, ...wt }, successPath)
        break;
      } else {
        num++;
        logger.warn('交易失败,休息6秒后重试...');
        await sleep(0.1);
        if (num === MAX_RETRY) {
          logger.error('重试次数已达上限');
          date = new Date().toLocaleString();
          await appendObjectToCSV({ date, ...wt, Error: '重试次数已达上限' }, errorPath)
          break;
        }
      }
    } catch (error) {
      num++;

      if (num === MAX_RETRY) {
        logger.error('重试次数已达上限');
        date = new Date().toLocaleString();
        await appendObjectToCSV({ date, ...wt, Error: error }, errorPath)
        break;
      }
      logger.error(`交易失败,休息6秒后重试...错误原因: ${error}`);
      await sleep(0.1);
    }
  }
  // 随机暂停 5-10分钟
  const sleepTime = Math.floor(Math.random() * (10 - 5) + 1);
  logger.info(`休息${sleepTime}分钟后继续...`)
  await sleep(sleepTime);
}


async function processQueue() {
  if (walletData.length === 0) return true;

  const wt = walletData.shift();
  await processWallet(wt, pwd);
  return processQueue();
}


(async function start() {
  logger.warn(`当前版本为: 1.0.0`);
  const results = await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, walletData.length) }, processQueue)
  );

  if (results.every(res => res)) {
    logger.warn(`所有线程执行完毕`);
    process.exit(0);
  }
})();



// async function handleMintTask() {

//   // 遍历钱包
//   for (let i = 0; i < wallets.length; i++) {
//     const wt = wallets[i];
//     const privateKey = decryptUsingAESGCM(wt.a, wt.e, wt.i, wt.s, pwd)
//     const connection = new Connection(rpc); // RPC，到https://www.helius.dev/注册获取
//     const wallet = new Wallet(Keypair.fromSecretKey(bs58.decode(privateKey)));
//     let p = new Worker('1', rpc, privateKey); // 请根据实际情况替换worker的实例化方式
//     let date;
//     // 查询SOL余额
//     const SOLBalance = await connection.getBalance(wallet.publicKey);
//     logger.info('wallet address:', wt.Address, 'SOLBalance:', SOLBalance);
//     if (SOLBalance < 0.0003 * 10 ** 9) {
//       logger.error(`钱包:${wt.Address}余额不足, SOL余额:${SOLBalance}`);
//       date = new Date().toLocaleString();
//       await appendObjectToCSV({ date, ...wt, Error: `余额不足,SOL余额:${SOLBalance}` }, errorPath);
//       continue;
//     }
//     const MAX_RETRY = 100;
//     let num = 0;

//     while (num < MAX_RETRY) {
//       try {
//         const txid = await p.vote(proposalId, voteId);
//         if (txid) {
//           logger.success(`交易成功:https://solscan.io/tx/${txid}`);
//           // 获取当前本地时间
//           date = new Date().toLocaleString();
//           await appendObjectToCSV({ date, ...wt }, successPath)
//           break;
//         } else {
//           num++;
//           logger.warn('交易失败,休息6秒后重试...');
//           await sleep(0.1);
//           if (num === MAX_RETRY) {
//             logger.error('重试次数已达上限');
//             date = new Date().toLocaleString();
//             await appendObjectToCSV({ date, ...wt, Error: '重试次数已达上限' }, errorPath)
//             break;
//           }
//         }
//       } catch (error) {
//         num++;

//         if (num === MAX_RETRY) {
//           logger.error('重试次数已达上限');
//           date = new Date().toLocaleString();
//           await appendObjectToCSV({ date, ...wt, Error: error }, errorPath)
//           break;
//         }
//         logger.error(`交易失败,休息6秒后重试...错误原因: ${error}`);
//         await sleep(0.1);
//       }
//     }
//     if (i < wallets.length - 1) {
//       // 随机暂停 5-10分钟
//       const sleepTime = Math.floor(Math.random() * (10 - 5) + 5);
//       logger.info(`休息${sleepTime}分钟后继续...`)
//       await sleep(sleepTime);
//     }

//   }

// }


// async function main() {
//   logger.warn(`当前版本为: 1.0.0`);
//   await handleMintTask();

// }

// main().catch((err) => {
//   console.error(err);
// });
