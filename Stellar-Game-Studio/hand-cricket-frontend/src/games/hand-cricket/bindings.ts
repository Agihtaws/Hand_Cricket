import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CCXDUYIHLPSPTAZ4KZCL5LHQVEZYQY2KCXWLIZ2JJCFDLQRY6JN55MOM",
  }
} as const


export interface Game {
  batter: Option<string>;
  innings: u32;
  p1_commitment: Option<Buffer>;
  p1_number: Option<u32>;
  p1_score: u32;
  p2_commitment: Option<Buffer>;
  p2_number: Option<u32>;
  p2_score: u32;
  phase: Phase;
  player1: string;
  player1_is_odd: boolean;
  player1_points: i128;
  player2: string;
  player2_points: i128;
  target: u32;
  toss_winner: Option<string>;
  winner: Option<string>;
}

export const Errors = {
  1: {message:"GameNotFound"},
  2: {message:"NotPlayer"},
  3: {message:"WrongPhase"},
  4: {message:"AlreadyCommitted"},
  5: {message:"AlreadyRevealed"},
  6: {message:"CommitMissing"},
  7: {message:"ProofInvalid"},
  8: {message:"GameAlreadyEnded"},
  9: {message:"SelfPlay"},
  10: {message:"NotTossWinner"}
}

export type Phase = {tag: "TossCommit", values: void} | {tag: "TossReveal", values: void} | {tag: "BatBowlChoice", values: void} | {tag: "BallCommit", values: void} | {tag: "BallReveal", values: void} | {tag: "Finished", values: void};

export type DataKey = {tag: "Game", values: readonly [u32]} | {tag: "GameHubAddress", values: void} | {tag: "Admin", values: void};

export interface Client {
  /**
   * Construct and simulate a get_hub transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_hub: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a set_hub transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_hub: ({new_hub}: {new_hub: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_game: ({session_id}: {session_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Game>>>

  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_admin: ({new_admin}: {new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a start_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  start_game: ({session_id, player1, player2, player1_points, player2_points}: {session_id: u32, player1: string, player2: string, player1_points: i128, player2_points: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a choose_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  choose_role: ({session_id, player, bat}: {session_id: u32, player: string, bat: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a commit_number transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  commit_number: ({session_id, player, commitment}: {session_id: u32, player: string, commitment: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a reveal_number transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  reveal_number: ({session_id, player, number, proof_blob}: {session_id: u32, player: string, number: u32, proof_blob: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, game_hub}: {admin: string, game_hub: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, game_hub}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAABEdhbWUAAAARAAAAAAAAAAZiYXR0ZXIAAAAAA+gAAAATAAAAAAAAAAdpbm5pbmdzAAAAAAQAAAAAAAAADXAxX2NvbW1pdG1lbnQAAAAAAAPoAAAD7gAAACAAAAAAAAAACXAxX251bWJlcgAAAAAAA+gAAAAEAAAAAAAAAAhwMV9zY29yZQAAAAQAAAAAAAAADXAyX2NvbW1pdG1lbnQAAAAAAAPoAAAD7gAAACAAAAAAAAAACXAyX251bWJlcgAAAAAAA+gAAAAEAAAAAAAAAAhwMl9zY29yZQAAAAQAAAAAAAAABXBoYXNlAAAAAAAH0AAAAAVQaGFzZQAAAAAAAAAAAAAHcGxheWVyMQAAAAATAAAAAAAAAA5wbGF5ZXIxX2lzX29kZAAAAAAAAQAAAAAAAAAOcGxheWVyMV9wb2ludHMAAAAAAAsAAAAAAAAAB3BsYXllcjIAAAAAEwAAAAAAAAAOcGxheWVyMl9wb2ludHMAAAAAAAsAAAAAAAAABnRhcmdldAAAAAAABAAAAAAAAAALdG9zc193aW5uZXIAAAAD6AAAABMAAAAAAAAABndpbm5lcgAAAAAD6AAAABM=",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACgAAAAAAAAAMR2FtZU5vdEZvdW5kAAAAAQAAAAAAAAAJTm90UGxheWVyAAAAAAAAAgAAAAAAAAAKV3JvbmdQaGFzZQAAAAAAAwAAAAAAAAAQQWxyZWFkeUNvbW1pdHRlZAAAAAQAAAAAAAAAD0FscmVhZHlSZXZlYWxlZAAAAAAFAAAAAAAAAA1Db21taXRNaXNzaW5nAAAAAAAABgAAAAAAAAAMUHJvb2ZJbnZhbGlkAAAABwAAAAAAAAAQR2FtZUFscmVhZHlFbmRlZAAAAAgAAAAAAAAACFNlbGZQbGF5AAAACQAAAAAAAAANTm90VG9zc1dpbm5lcgAAAAAAAAo=",
        "AAAAAgAAAAAAAAAAAAAABVBoYXNlAAAAAAAABgAAAAAAAAAAAAAAClRvc3NDb21taXQAAAAAAAAAAAAAAAAAClRvc3NSZXZlYWwAAAAAAAAAAAAAAAAADUJhdEJvd2xDaG9pY2UAAAAAAAAAAAAAAAAAAApCYWxsQ29tbWl0AAAAAAAAAAAAAAAAAApCYWxsUmV2ZWFsAAAAAAAAAAAAAAAAAAhGaW5pc2hlZA==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAwAAAAEAAAAAAAAABEdhbWUAAAABAAAABAAAAAAAAAAAAAAADkdhbWVIdWJBZGRyZXNzAAAAAAAAAAAAAAAAAAVBZG1pbgAAAA==",
        "AAAAAAAAAAAAAAAHZ2V0X2h1YgAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAHc2V0X2h1YgAAAAABAAAAAAAAAAduZXdfaHViAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAA",
        "AAAAAAAAAAAAAAAIZ2V0X2dhbWUAAAABAAAAAAAAAApzZXNzaW9uX2lkAAAAAAAEAAAAAQAAA+kAAAfQAAAABEdhbWUAAAAD",
        "AAAAAAAAAAAAAAAJZ2V0X2FkbWluAAAAAAAAAAAAAAEAAAAT",
        "AAAAAAAAAAAAAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAKc3RhcnRfZ2FtZQAAAAAABQAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAAAAAAHcGxheWVyMQAAAAATAAAAAAAAAAdwbGF5ZXIyAAAAABMAAAAAAAAADnBsYXllcjFfcG9pbnRzAAAAAAALAAAAAAAAAA5wbGF5ZXIyX3BvaW50cwAAAAAACwAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAALY2hvb3NlX3JvbGUAAAAAAwAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAAAAAAGcGxheWVyAAAAAAATAAAAAAAAAANiYXQAAAAAAQAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAIZ2FtZV9odWIAAAATAAAAAA==",
        "AAAAAAAAAAAAAAANY29tbWl0X251bWJlcgAAAAAAAAMAAAAAAAAACnNlc3Npb25faWQAAAAAAAQAAAAAAAAABnBsYXllcgAAAAAAEwAAAAAAAAAKY29tbWl0bWVudAAAAAAD7gAAACAAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAANcmV2ZWFsX251bWJlcgAAAAAAAAQAAAAAAAAACnNlc3Npb25faWQAAAAAAAQAAAAAAAAABnBsYXllcgAAAAAAEwAAAAAAAAAGbnVtYmVyAAAAAAAEAAAAAAAAAApwcm9vZl9ibG9iAAAAAAAOAAAAAQAAA+kAAAACAAAAAw==" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_hub: this.txFromJSON<string>,
        set_hub: this.txFromJSON<null>,
        upgrade: this.txFromJSON<null>,
        get_game: this.txFromJSON<Result<Game>>,
        get_admin: this.txFromJSON<string>,
        set_admin: this.txFromJSON<null>,
        start_game: this.txFromJSON<Result<void>>,
        choose_role: this.txFromJSON<Result<void>>,
        commit_number: this.txFromJSON<Result<void>>,
        reveal_number: this.txFromJSON<Result<void>>
  }
}