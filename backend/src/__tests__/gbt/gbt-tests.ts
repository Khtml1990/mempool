import fs from 'fs';
import { GbtGenerator } from '../../../rust-gbt';
import path from 'path';
import { CompactThreadTransaction } from '../../mempool.interfaces';

const baseline = require('./test-data/target-template.json');
const testVector = require('./test-data/test-data-ids.json');
const vectorUidMap: Map<number, string> = new Map(testVector.map(x => [x[0], x[1]]));
const vectorTxidMap: Map<string, number>  = new Map(testVector.map(x => [x[1], x[0]]));
// Note that this test buffer is specially constructed
// such that uids are assigned in numerical txid order
// so that ties break the same way as in Core's implementation
const vectorBuffer: Buffer = fs.readFileSync(path.join(__dirname, './', './test-data/test-buffer.bin'));

describe('Rust GBT', () => {
  test('should produce the same template as getBlockTemplate from Bitcoin Core', async () => {
    const rustGbt = new GbtGenerator();
    const mempool = mempoolFromArrayBuffer(vectorBuffer.buffer);
    const result = await rustGbt.make(mempool);

    const blocks: [string, number][][] = result.blocks.map(block => {
      return block.map(uid => [vectorUidMap.get(uid) || 'missing', uid]);
    });
    const template = baseline.map(tx => [tx.txid, vectorTxidMap.get(tx.txid)]);

    expect(blocks[0].length).toEqual(baseline.length);
    expect(blocks[0]).toEqual(template);
  });
});

function mempoolFromArrayBuffer(buf: ArrayBuffer): CompactThreadTransaction[] {
  const view = new DataView(buf);
  const count = view.getUint32(0, false);
  const txs: CompactThreadTransaction[] = [];
  let offset = 4;
  for (let i = 0; i < count; i++) {
    const tx: CompactThreadTransaction = {
      uid: view.getUint32(offset, false),
      fee: view.getFloat64(offset + 4, false),
      weight: view.getUint32(offset + 12, false),
      sigops: view.getUint32(offset + 16, false),
      feePerVsize: view.getFloat64(offset + 20, false),
      effectiveFeePerVsize: view.getFloat64(offset + 28, false),
      inputs: [],
    };
    const numInputs = view.getUint32(offset + 36, false);
    offset += 40;
    for (let j = 0; j < numInputs; j++) {
      tx.inputs.push(view.getUint32(offset, false));
      offset += 4;
    }
    txs.push(tx);
  }
  return txs;
}
