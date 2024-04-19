const Logger = require("@youpaichris/logger");
const cp = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const anchor = require("@coral-xyz/anchor");
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


let keysPath = "keys.txt";
let sucessAddressPath = "sucessAddress.txt";
let failAddressPath = "failAddress.txt";
let callerPath = path.join(__dirname, "src", "caller.js");
let keysPrivateKeys = [];
let sucessAddress = [];
let failAddress = [];
if (process.pkg) {
  // 如果通过 pkg 打包，则使用这种方式获取路径
  const exePath = path.dirname(process.execPath);
  keysPath = path.join(exePath, keysPath);
  sucessAddressPath = path.join(exePath, sucessAddressPath);
  failAddressPath = path.join(exePath, failAddressPath);
}

let rpc = "https://mainnet.helius-rpc.com/?api-key=aac42329-3edf-4433-94ec-870600c2ba9e";
const wallet_path = '/Users/lishuai/Documents/crypto/bockchainbot/SOLTestWalle加密.csv'; // 钱包文件路径


const pwd = readlineSync.question('Please enter your password: ', {
  hideEchoBack: true // 密码不回显
});
const wallets = convertCSVToObjectSync(wallet_path);


async function handleMintTask() {

  // 遍历钱包
  for (let i = 0; i < wallets.length; i++) {
    const wt = wallets[i];
    const privateKey = decryptUsingAESGCM(wt.a, wt.e, wt.i, wt.s, pwd)
    const connection = new Connection(rpc); // RPC，到https://www.helius.dev/注册获取
    const wallet = new Wallet(Keypair.fromSecretKey(bs58.decode(privateKey)));
    const tokenOut = 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'; // 获得Token，JUP Token 地址
    let p = new Worker('1', rpc, privateKey); // 请根据实际情况替换worker的实例化方式
    let date;
    // 查询SOL余额
    const SOLBalance = await connection.getBalance(wallet.publicKey);
    const jupBalanceInfo = await getSPLBalance(connection, wallet.publicKey, tokenOut);
    if (SOLBalance < 0.0003 * 10 ** 9 | jupBalanceInfo.uiAmount < 1000 * 10 ** 6) {
      logger.error(`钱包:${wt.Address}余额不足, SOL余额:${SOLBalance}, JUP余额:${jupBalanceInfo.uiAmount}`);
      date = new Date().toLocaleString();
      await appendObjectToCSV({ date, ...wt, Error: '余额不足' }, './logs/StakeError.csv')
      break;
    }
    logger.info('wallet address:', wt.Address, 'SOLBalance:', SOLBalance, 'jupBalance:', jupBalanceInfo.uiAmount, 'depost amount:', jupBalanceInfo.uiAmount);

    const MAX_RETRY = 100;
    let num = 0;


    while (num < MAX_RETRY) {
      try {

        const txid = await p.stake(jupBalanceInfo.amount);
        if (txid) {
          logger.success(`交易成功:https://solscan.io/tx/${txid}`);
          // 获取当前本地时间
          date = new Date().toLocaleString();
          await appendObjectToCSV({ date, ...wt }, './logs/StakeSucess.csv')
          break;
        } else {
          num++;
          logger.warn('交易失败,休息1秒后重试...');
          await sleep(0.02);
          if (num === MAX_RETRY) {
            logger.error('重试次数已达上限');
            date = new Date().toLocaleString();
            await appendObjectToCSV({ date, ...wt, Error: '重试次数已达上限' }, './logs/StakeError.csv')
            break;
          }
        }
      } catch (error) {
        num++;
        logger.error(`交易失败,休息1秒后重试...错误原因: ${error}`);
        await sleep(0.02);
        if (num === MAX_RETRY) {
          logger.error('重试次数已达上限');
          date = new Date().toLocaleString();
          await appendObjectToCSV({ date, ...wt, Error: error }, './logs/StakeError.csv')
          break;
        }
      }
    }
    if (i < wallets.length - 1) {
      // 随机暂停 5-10分钟
      const sleepTime = Math.floor(Math.random() * (10 - 5) + 5);
      logger.info(`休息${sleepTime}分钟后继续...`)
      await sleep(sleepTime);
    }

  }

}


async function main() {
  logger.warn(`当前版本为: 1.0.0`);
  await handleMintTask();
}

main().catch((err) => {
  console.error(err);
});
