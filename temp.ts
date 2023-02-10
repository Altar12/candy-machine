import * as web3 from "@solana/web3.js"
import * as token from "@solana/spl-token"
import * as fs from "fs"


async function main() {
    // connection to solana devnet
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"))

    // read the user keypair from file
    const fileContents = fs.readFileSync("./test.json").toString()
    const secret = JSON.parse(fileContents) as number[];
    const secretKey = Uint8Array.from(secret);
    const keypairFromSecret = web3.Keypair.fromSecretKey(secretKey);

    const ata = await token.createAssociatedTokenAccount(connection, keypairFromSecret, new web3.PublicKey("CdTSKSumqhybzo2BpaQ6jwP6foFrP8XverwrFhCBJ7Sz"), keypairFromSecret.publicKey)
    console.log(ata.toBase58())
}

main()
    .then(() => {
        console.log("Finished successfully")
        process.exit(0)
    })
    .catch((error) => {
        console.log(error)
        process.exit(1)
    })