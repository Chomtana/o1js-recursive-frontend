import { Field, SelfProof, ZkProgram, verify } from 'o1js';

const Add = ZkProgram({
  name: 'add-example',
  publicInput: Field,

  methods: {
    init: {
      privateInputs: [],

      async method(state: Field) {
        state.assertEquals(Field(0));
      },
    },

    addNumber: {
      privateInputs: [SelfProof, Field],

      async method(
        newState: Field,
        earlierProof: SelfProof<Field, void>,
        numberToAdd: Field
      ) {
        earlierProof.verify();
        newState.assertEquals(earlierProof.publicInput.add(numberToAdd));
      },
    },

    addBatch: {
      privateInputs: [SelfProof, Field],

      async method(
        newState: Field,
        earlierProof: SelfProof<Field, void>,
        numberToAdd: Field
      ) {
        earlierProof.verify();

        const bits = numberToAdd.toBits(252);
        let target = earlierProof.publicInput

        for (let _ = 0; _ < 10; _++) {
          for (let i = 0; i < 84; i++) {
            target = target.add(bits[i*3].toField().mul(4)).add(bits[i*3+1].toField().mul(2)).add(bits[i*3+2].toField())
          }
        }

        newState.assertEquals(target)
      },
    },

    add: {
      privateInputs: [SelfProof, SelfProof],

      async method(
        newState: Field,
        earlierProof1: SelfProof<Field, void>,
        earlierProof2: SelfProof<Field, void>
      ) {
        earlierProof1.verify();
        earlierProof2.verify();
        newState.assertEquals(
          earlierProof1.publicInput.add(earlierProof2.publicInput)
        );
      },
    },
  },
});

export async function performAdd() {
  console.log('compiling...');

  const { verificationKey } = await Add.compile();

  console.log('making proof 0');

  const startTime = Date.now()
  const { proof: proof0 } = await Add.init(Field(0));
  console.log('Init time', (Date.now() - startTime) / 1000)

  let randSum = 0
  let randNums: number[] = []
  for (let i = 0; i < 84; i++) {
    const num = Math.floor(Math.random() * 8)
    randSum += num
    randNums.push(num)
  }

  randSum *= 10

  const randBits = randNums.map(num => {
    const bits = num.toString(2).padStart(3, '0');
    return [bits[0] === '1', bits[1] === '1', bits[2] === '1'];
  });

  const randField = Field.fromBits(randBits.flat())

  console.log('making proof batch rand');

  const batchRandStartTime = Date.now();
  const { proof: proofBatchRand } = await Add.addBatch(new Field(randSum), proof0, randField);
  console.log('Batch Rand time', (Date.now() - batchRandStartTime) / 1000)

  console.log('making proof batch zero');

  const batchZeroStartTime = Date.now()
  const { proof: proofBatchZero } = await Add.addBatch(new Field(randSum), proofBatchRand, Field(0));
  console.log('Batch Zero time', (Date.now() - batchZeroStartTime) / 1000)

  console.log('making proof 1');

  const proof1StartTime = Date.now()
  const { proof: proof1 } = await Add.addNumber(Field(randSum + 4), proofBatchZero, Field(4));
  console.log('Proof 1 time', (Date.now() - proof1StartTime) / 1000)

  
  console.log('making proof 2');

  const proof2StartTime = Date.now()
  const { proof: proof2 } = await Add.add(Field(randSum * 2 + 4), proof1, proofBatchRand);
  console.log('Proof 2 time', (Date.now() - proof2StartTime) / 1000)

  console.log('verifying proof 2');
  console.log('proof 2 data', proof2.publicInput.toString());

  let currProof = proof2

  for (let i = 3; i <= 10; i++) {
    console.log('making proof ' + i);

    const proof2StartTime = Date.now()
    const { proof: proof2 } = await Add.addNumber(Field(randSum * 2 + 4 * (i - 1)), currProof, Field(4));
    console.log('Proof ' + i + ' time', (Date.now() - proof2StartTime) / 1000)
  
    console.log('verifying proof ' + i);
    console.log('proof ' + i + ' data', proof2.publicInput.toString());

    currProof = proof2
  }

  const verifyStartTime = Date.now()
  const ok = await verify(currProof.toJSON(), verificationKey);
  console.log('Verify time', (Date.now() - verifyStartTime) / 1000)
  console.log('ok', ok);
}
