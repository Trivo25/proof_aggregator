import { Experimental, Field, SelfProof } from "snarkyjs";

export { MyProgram, ProofPayload, baseCase, inductiveCase };

const MyProgram: any = Experimental.ZkProgram({
  publicInput: Field,

  methods: {
    baseCase: {
      privateInputs: [Field],

      method(publicInput: Field, x: Field) {
        x.add(1).assertEquals(publicInput);
      },
    },

    inductiveCase: {
      privateInputs: [SelfProof, SelfProof],

      method(publicInput: Field, p1: SelfProof<Field>, p2: SelfProof<Field>) {
        p1.verify();
        p2.verify();
        p1.publicInput.add(p2.publicInput).assertEquals(publicInput);
      },
    },
  },
});

interface ProofPayload<T> {
  payload: SelfProof<T> | T;
  isProof: boolean;
}

/**
 * This increments Field(1) to Field(2)
 */
async function baseCase(x: ProofPayload<Field>): Promise<ProofPayload<Field>> {
  let proof = await MyProgram.baseCase(Field(2), x.payload as Field);
  return {
    payload: proof,
    isProof: true,
  };
}

/**
 * This merges two proofs into one
 */
async function inductiveCase(
  pl1: ProofPayload<Field>,
  pl2: ProofPayload<Field>
): Promise<ProofPayload<Field>> {
  let p1 = pl1.payload as SelfProof<Field>;
  let p2 = pl2.payload as SelfProof<Field>;
  let proof = await MyProgram.inductiveCase(
    p1.publicInput.add(p2.publicInput),
    p1,
    p2
  );
  return {
    payload: proof,
    isProof: true,
  };
}
