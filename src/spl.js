const { Connection, Keypair, VersionedTransaction, PublicKey } = require('@solana/web3.js');
const fetch = require('cross-fetch');
const { Wallet } = require('@project-serum/anchor');
const bs58 = require('bs58');
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require('@solana/spl-token'); // version 0.1.x



async function getSPLBalance(connection, address, mint) {
    const addressKey = new PublicKey(address)
    const mintKey = new PublicKey(mint);
    let tokenAccounts = await connection.getParsedTokenAccountsByOwner(addressKey, { mint: mintKey });

    let amount = 0;
    let decimals = 0;
    let uiAmount = 0;
    if (tokenAccounts.value.length > 0) {

        for (const account of tokenAccounts.value) {
            const tokenAmount = account.account.data.parsed.info.tokenAmount;
            amount += Number(tokenAmount.amount);
            uiAmount += tokenAmount.uiAmount;
            decimals = tokenAmount.decimals;
        }
    }
    return { amount, uiAmount, decimals };
}
module.exports = { getSPLBalance };