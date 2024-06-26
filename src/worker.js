const Logger = require("@youpaichris/logger");
const logger = new Logger();
const anchor = require("@coral-xyz/anchor");
const {
  Keypair,
  PublicKey,
  Message,
  VersionedTransaction,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  LAMPORTS_PER_SOL,
  SYSVAR_CLOCK_PUBKEY,
} = require("@solana/web3.js");
const dotenv = require("dotenv");
dotenv.config();
const TYPE = parseInt(process.env.TYPE) || 1;
const Amount =
  new anchor.BN(parseFloat(process.env.AMOUNT) * 1e6) || new anchor.BN(0);
const UNIT_PRICE =
  parseFloat(process.env.UNIT_PRICE) * LAMPORTS_PER_SOL || 150000;
const {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  MintLayout,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
} = require("@solana/spl-token");

// //导入 idl.json
const idl = require("./idl.json");
const governIDL = require("./IDLGOV.json");
const locked_voter = new PublicKey(
  "voTpe3tHQ7AjQHMapgSue2HJFAh2cGsdokqN3XqmVSj"
);

//投票链接  https://vote.jup.ag/proposal/5N9UbMGzga3SL8Rq7qDZCGfZX3FRDUhgqkSY2ksQjg8r
//再改下 投票id 就行了
const proposalId = new PublicKey(
  "DhJAwGDtHYdEy8mBoeZ3Yub5potxRJbvzycYUwhFGfox"
);
// const voteId = 2;
const jupAddress = new PublicKey("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN");
const locker = new PublicKey("CVMdMd79no569tjc5Sq7kzz8isbfCcFyBS5TLGsrZ5dN");
//此处locker 是 由  bJ1TRoFo2P6UHVwqdiipp6Qhp2HaaHpLowZ5LHet8Gm (未知)和 voTpe3tHQ7AjQHMapgSue2HJFAh2cGsdokqN3XqmVSj (质押地址)计算得出的
// function deriveLocker() {
//   const basePublic = new PublicKey(
//     "bJ1TRoFo2P6UHVwqdiipp6Qhp2HaaHpLowZ5LHet8Gm"
//   );
//   const locked_voter = new PublicKey(
//     "voTpe3tHQ7AjQHMapgSue2HJFAh2cGsdokqN3XqmVSj"
//   );
//   return PublicKey.findProgramAddressSync(
//     [Buffer.from("Locker"), basePublic.toBytes()],
//     locked_voter
//   );
// }
//未知作用
// const SmartWallet = new PublicKey(
//   "GYxjWMU9Bp2o3psFNFnhEZTYsHTE24WQuSU6iGrLZ9EZ"
// );
// function deriveSmartWallet() {
//   const basePublic = new PublicKey(
//     "bJ1TRoFo2P6UHVwqdiipp6Qhp2HaaHpLowZ5LHet8Gm"
//   );
//   const smart = new PublicKey("smaK3fwkA7ubbxEhsimp1iqPTzfS4MBsNL77QLABZP6");
//   return PublicKey.findProgramAddressSync(
//     [Buffer.from("SmartWallet"), basePublic.toBytes()],
//     smart
//   );
// }
const governor = new PublicKey("EZjEbaSd1KrTUKHNGhyHj42PxnoK742aGaNNqb9Rcpgu");
// function deriveGovern() {
//   const basePublic = new PublicKey(
//     "bJ1TRoFo2P6UHVwqdiipp6Qhp2HaaHpLowZ5LHet8Gm"
//   );
const Governor = new PublicKey("GovaE4iu227srtG2s3tZzB4RmWBzw8sTwrCLZz7kN7rY");
//   return m.rV.PublicKey.findProgramAddressSync(
//     [Buffer.from("Governor"), basePublic.toBytes()],
//     Governor
//   );
// }

function getWallet(privateKey) {
  const MyKeyPair = Keypair.fromSecretKey(
    anchor.utils.bytes.bs58.decode(privateKey)
  );
  const wallet = new anchor.Wallet(MyKeyPair);
  return wallet;
}

function deriveEscrow(e, t, a) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("Escrow"), e.toBytes(), t.toBytes()],
    a
  );
}

function deriveVote(e, t) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("Vote"), t.toBytes(), e.toBytes()],
    Governor
  );
}

class Worker {
  constructor(index, rpc, privateKey) {
    this.privateKey = privateKey;
    this.index = index;
    this.rpc = rpc;

    this.connection = new anchor.web3.Connection(this.rpc, "confirmed");
    this.wallet = getWallet(this.privateKey);
    this.provider = new anchor.AnchorProvider(this.connection, this.wallet, {
      commitment: "confirmed",
    });
    this.program = new anchor.Program(idl, locked_voter, this.provider);
    this.governProgram = new anchor.Program(governIDL, Governor, this.provider);
    // this.connection = connection;
    // this.wallet = wallet;
    // this.provider = provider;
    // this.program = program;
    // this.governProgram = governProgram;

  }

  async work() {
    const balance = await this.checkBalance(this.wallet.publicKey);

    if (balance && balance < 0.003 * LAMPORTS_PER_SOL) {
      logger.error(`${this.wallet.publicKey.toBase58()} Insufficient balance`);
    }
    if (TYPE === 1) {
      if (Amount.isZero()) {
        logger.error(`第${this.index} 子进程 质押金额 为0 错误`);
        return false;
      }
      //获取jupAddress 的余额
      const jupBalance = await this.checkTokenBalance(this.wallet.publicKey);
      if (jupBalance === 0) {
        logger.error(
          `${this.wallet.publicKey.toBase58()} Insufficient jup balance`
        );
      }
    }

    let successCount = 0;

    while (successCount < 1) {
      let success;
      if (TYPE === 1) {
        success = await this.stake();
      } else {
        success = await this.vote();
      }
      if (!success) {
        logger.error(
          `第${this.index} 子进程 地址:${this.wallet.publicKey.toBase58()} ${TYPE === 1 ? "质押" : "投票"
          }失败 重试...`
        );
      } else {
        successCount++;
        return true;
      }
    }
  }

  async getOrCreateATAInstruction(e, t, a) {
    let r,
      n = arguments.length > 3 && void 0 !== arguments[3] && arguments[3],
      s = arguments.length > 4 && void 0 !== arguments[4] ? arguments[4] : t;
    try {
      r = await getAssociatedTokenAddress(e, t, n);

      let i = await a.getAccountInfo(r);
      if (!i) {
        let a = createAssociatedTokenAccountInstruction(s, r, t, e);
        return [r, a];
      }
      return [r, void 0];
    } catch (e) {
      throw (console.error("Error::getOrCreateATAInstruction", e), e);
    }
  }

  async getOrCreateEscrow() {
    let t = locker;
    let {
      provider: { wallet: e },
      program: a,
    } = this,
      [r, o] = deriveEscrow(t, e.publicKey, locked_voter);
    try {
      return await a.account.escrow.fetch(r), [r, null];
    } catch (n) {
      let o = await a.methods
        .newEscrow()
        .accounts({
          escrow: r,
          escrowOwner: e.publicKey,
          locker: t,
          payer: e.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      return [r, o];
    }
  }

  async stake(stakeAmount) {
    stakeAmount = new anchor.BN(stakeAmount)
    // try {
    let {
      wallet,
      provider: { connection },
    } = this;
    let [c, u] = await this.getOrCreateEscrow(),
      [d, p] = await this.getOrCreateATAInstruction(jupAddress, c, connection, !0, wallet.publicKey),
      [y, h] = await this.getOrCreateATAInstruction(jupAddress, wallet.publicKey, connection, !0, wallet.publicKey),
      g = [u, p, h].filter(Boolean),
      v = this.program.methods.increaseLockedAmount(stakeAmount).accounts({
        escrow: c,
        escrowTokens: d,
        locker: locker,
        payer: wallet.publicKey,
        sourceTokens: y,
        tokenProgram: TOKEN_PROGRAM_ID,
      });

    let instruction = await v.instruction();

    let signature = await this.toggleMaxDuration(!0, [...g, instruction]);
    return signature;
  }

  async unlock() {

    let { wallet, program } = this;
    let o = arguments.length > 4 && void 0 !== arguments[4] ? arguments[4] : []
    o.unshift(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: UNIT_PRICE,
      }),
      ComputeBudgetProgram.setComputeUnitLimit({ units: 150000 })
    );
    let [c, l] = deriveEscrow(locker, wallet.publicKey, locked_voter);
    return await program.methods
      .toggleMaxLock(false)
      .accounts({
        locker: locker,
        escrow: c,
        escrowOwner: this.wallet.publicKey,
        payer: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .preInstructions(o)
      .rpc();

  }

  async vote(proposalId, voteId) {

    proposalId = new PublicKey(proposalId);
    try {
      let [a, r] = await this.getOrCreateVote(proposalId);

      let signature = await this.voteProposal(
        proposalId,
        a,
        governor,
        voteId,
        r ? [r] : []
      );
      return signature;

      // if (signature) {
      //   logger.success(
      //     `第${this.index
      //     } 子进程 ${this.wallet.publicKey.toBase58()} 投票成功 ${signature}`
      //   );
      //   return true;
      // } else {
      //   logger.error(
      //     `第${this.index} 子进程 ${this.wallet.publicKey.toBase58()} 投票失败`
      //   );
      //   return false;
      // }
    } catch (error) {
      logger.error(`投票交易 Error: ${error.message}`);
      // return false;
    }
  }

  async voteProposal(e, t, a, r) {
    let o = arguments.length > 4 && void 0 !== arguments[4] ? arguments[4] : [],
      { wallet, program } = this;

    o.unshift(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: UNIT_PRICE,
      }),
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 })
    );
    let [c, l] = deriveEscrow(locker, wallet.publicKey, locked_voter);
    return await program.methods
      .castVote(r)
      .accounts({
        escrow: c,
        governor: a,
        governProgram: Governor,
        locker: locker,
        proposal: e,
        vote: t,
        voteDelegate: wallet.publicKey,
      })
      .preInstructions(o)
      .rpc();
  }

  async getOrCreateVote(e) {
    let { wallet, provider, governProgram } = this,
      [r, o] = deriveVote(wallet.publicKey, e);
    try {
      return await this.governProgram.account.vote.fetch(r), [r, null];
    } catch (n) {
      let o = await this.governProgram.methods
        .newVote(wallet.publicKey)
        .accounts({
          payer: wallet.publicKey,
          proposal: e,
          systemProgram: SystemProgram.programId,
          vote: r,
        })
        .instruction();
      return [r, o];
    }
  }

  async toggleMaxDuration(e, t) {
    let [a] = await this.getOrCreateEscrow();
    t.unshift(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: UNIT_PRICE,
      }),
      ComputeBudgetProgram.setComputeUnitLimit({ units: 800000 })
    );
    return await this.program.methods
      .toggleMaxLock(e)
      .accounts({
        escrow: a,
        locker: locker,
        escrowOwner: this.wallet.publicKey,
      })
      .preInstructions(t || [])
      .rpc();
  }

  async checkBalance(publicKey) {
    for (let index = 0; index < 5; index++) {
      try {
        const balance = await this.connection.getBalance(publicKey);
        logger.info(
          `${publicKey.toBase58()} 当前余额 ${balance / LAMPORTS_PER_SOL} SOL`
        );
        return balance;
      } catch (error) {
        logger.error(
          `${publicKey.toBase58()} 获取余额失败,正在重试...${index + 1}`
        );
      }
    }
  }

  async checkTokenBalance(publicKey) {
    for (let index = 0; index < 5; index++) {
      try {
        const tokenAccount = await getAssociatedTokenAddress(
          jupAddress,
          publicKey,
          true
        );
        const balance = await this.connection.getTokenAccountBalance(
          tokenAccount
        );
        logger.info(
          `${publicKey.toBase58()} 当前jup余额 ${balance?.value?.uiAmount} JUP`
        );
        return balance?.value?.uiAmount;
      } catch (error) {
        logger.error(
          `${publicKey.toBase58()} 获取jup余额失败,正在重试...${index + 1}`
        );
      }
    }
  }
}

// export default Worker;
module.exports = Worker;
