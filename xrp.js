const fs = require('fs');
const readline = require('readline');
const bip39 = require('bip39');
const bip32 = require('ripple-bip32');
const ripple = require('ripple-keypairs');

/**
 * Derive Ripple address from a mnemonic (12 or 24 words).
 * 
 * @param {string} mnemonic - The 12 or 24-word mnemonic.
 * @returns {Promise<string>} - The corresponding Ripple address.
 */
async function deriveRippleAddress(mnemonic) {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic');
  }

  const seed = await bip39.mnemonicToSeed(mnemonic);
  const keyPair = bip32.fromSeedBuffer(seed).derivePath("m/44'/144'/0'/0/0").keyPair.getKeyPairs();
  const address = ripple.deriveAddress(keyPair.publicKey);

  return address;
}

/**
 * Process mnemonics from the file, derive Ripple addresses, and write results in real-time.
 * Handles large files by reading line-by-line.
 * 
 * @param {string} inputFilePath - Path to the file containing mnemonics (one per line).
 * @param {string} outputFilePath - Path to the file to write results (mnemonic|address).
 * @returns {Promise<void>}
 */
async function deriveAddressesFromFile(inputFilePath, outputFilePath) {
  try {
    const fileStream = fs.createReadStream(inputFilePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const writeStream = fs.createWriteStream(outputFilePath, { flags: 'w' });

    let totalLines = 0;
    let processedLines = 0;

    // First, we count total lines for progress calculation
    rl.on('line', (line) => totalLines++);
    
    rl.on('close', async () => {
      // Re-read file line by line to process mnemonics and derive addresses
      const rl2 = readline.createInterface({
        input: fs.createReadStream(inputFilePath),
        crlfDelay: Infinity
      });

      for await (const line of rl2) {
        const mnemonic = line.trim();
        if (mnemonic) {
          try {
            const address = await deriveRippleAddress(mnemonic);
            // Write to the output file immediately after processing
            await new Promise((resolve, reject) => {
              writeStream.write(`${mnemonic}|${address}\n`, (err) => {
                if (err) reject(err);
                resolve();
              });
            });
          } catch (err) {
            console.error(`Error deriving address for mnemonic: ${mnemonic}`, err);
            await new Promise((resolve, reject) => {
              writeStream.write(`${mnemonic}|Error deriving address\n`, (err) => {
                if (err) reject(err);
                resolve();
              });
            });
          }
        }

        processedLines++;

        // Show progress in terminal
        const percent = Math.floor((processedLines / totalLines) * 100);
        process.stdout.write(`\rProcessing... ${percent}% (${processedLines}/${totalLines})`);
      }

      writeStream.end();
      console.log(`\nResults written to ${outputFilePath}`);
    });
  } catch (err) {
    console.error('Error processing mnemonics:', err);
  }
}

// Example usage:
const inputFilePath = 'mnemonics.txt';  // Path to the input file containing mnemonics
const outputFilePath = 'XRP.txt'; // Path to the output file to save mnemonic|address results

deriveAddressesFromFile(inputFilePath, outputFilePath);
