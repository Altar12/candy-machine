import * as web3 from "@solana/web3.js"
import * as token from "@solana/spl-token"
import * as fs from "fs"
import { bundlrStorage, findMetadataPda, keypairIdentity, Metaplex, toMetaplexFile } from "@metaplex-foundation/js"
import { DataV2, createCreateMetadataAccountV2Instruction } from "@metaplex-foundation/mpl-token-metadata"

const TOKEN_NAME = "RUBY"
const TOKEN_SYMBOL = "RUB"
const TOKEN_DESCRIPTION = "A very rare ruby token"
const TOKEN_IMAGE_NAME = "jewel.png"
const TOKEN_IMAGE_PATH = `./${TOKEN_IMAGE_NAME}`

async function createBldToken(
    connection: web3.Connection,
    payer: web3.Keypair,
) {

    // create a new token mint
    const tokenMint = await token.createMint(connection, payer, payer.publicKey, null, 2)

    // create associated token account to receive tokens
    const phantomAddr = new web3.PublicKey("2VHGyT2AbGeK7ohNRFYXeQHU8LMgnqXBijazcEDpo2c9")
    const tokenAccAddr = token.getAssociatedTokenAddressSync(tokenMint, phantomAddr)
    const txn = new web3.Transaction().add(
        token.createAssociatedTokenAccountInstruction(payer.publicKey, tokenAccAddr, phantomAddr, tokenMint)
    )
    await web3.sendAndConfirmTransaction(connection, txn, [payer])  
    
    // mint 100 tokens to phantom wallet
    const txnSignature = await token.mintTo(connection, payer, tokenMint, tokenAccAddr, payer, 10000)
    console.log("Minted 100 tokens")
    console.log(`https://explorer.solana.com/tx/${txnSignature}?cluster=devnet`)

    const metaplex = Metaplex.make(connection).use(keypairIdentity(payer)).use(bundlrStorage({
        address: "https://devnet.bundlr.network",
        providerUrl: "https://api.devnet.solana.com",
        timeout: 60000,
    }))

    // upload token image to arweave
    const imageBuffer = fs.readFileSync(TOKEN_IMAGE_PATH)
    const file = toMetaplexFile(imageBuffer, TOKEN_IMAGE_NAME)
    const imageUri = await metaplex.storage().upload(file)

    // add token metadata to arweave
    const { uri } = await metaplex.nfts().uploadMetadata({
        name: TOKEN_NAME,
        description: TOKEN_DESCRIPTION,
        image: imageUri,
    }) // adding .run() errors out

    // enter token metadata details
    const metadataPda = findMetadataPda(tokenMint)
    const tokenMetadata = {
        name: TOKEN_NAME,
        symbol: TOKEN_SYMBOL,
        uri,
        sellerFeeBasisPoints: 0,
        creators: null,
        collection: null,
        uses: null
    } as DataV2

    // create metadata account by creating and sending txn
    const instruction = createCreateMetadataAccountV2Instruction({
        metadata: metadataPda,
        mint: tokenMint,
        mintAuthority: payer.publicKey,
        payer: payer.publicKey,
        updateAuthority: payer.publicKey
    }, {
        createMetadataAccountArgsV2: {
            data: tokenMetadata,
            isMutable: true
        }
    })

    const transaction = new web3.Transaction()
    transaction.add(instruction)

    const transactionSignature = await web3.sendAndConfirmTransaction(connection, transaction, [payer])
    console.log("created metadata account")
    console.log(`https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`)

    // store token related information
    fs.writeFileSync("./cache.json", 
        JSON.stringify({
            mint: tokenMint.toBase58(),
            imageUri,
            metadataUri: uri,
            tokenMetadata: metadataPda.toBase58(),
            metadataTransaction: transactionSignature,
        }))

    
}

async function main() {
    // connection to solana devnet
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"))

    // read the user keypair from file
    const fileContents = fs.readFileSync("./test.json").toString()
    const secret = JSON.parse(fileContents) as number[];
    const secretKey = Uint8Array.from(secret);
    const keypairFromSecret = web3.Keypair.fromSecretKey(secretKey);

    // create the token along with metadata
    await createBldToken(connection, keypairFromSecret)
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