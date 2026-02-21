#![no_std]

use soroban_sdk::{
    Address, Bytes, BytesN, Env, IntoVal, contract, contractclient,
    contracterror, contractimpl, contracttype, vec,
};

#[contractclient(name = "GameHubClient")]
pub trait GameHub {
    fn start_game(env: Env, game_id: Address, session_id: u32, player1: Address, player2: Address, player1_points: i128, player2_points: i128);
    fn end_game(env: Env, session_id: u32, player1_won: bool);
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    GameNotFound     = 1,
    NotPlayer        = 2,
    WrongPhase       = 3,
    AlreadyCommitted = 4,
    AlreadyRevealed  = 5,
    CommitMissing    = 6,
    ProofInvalid     = 7,
    GameAlreadyEnded = 8,
    SelfPlay         = 9,
    NotTossWinner    = 10,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Phase {
    TossCommit,
    TossReveal,
    BatBowlChoice,
    BallCommit,
    BallReveal,
    Finished,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Game {
    pub player1: Address,
    pub player2: Address,
    pub player1_points: i128,
    pub player2_points: i128,
    pub player1_is_odd: bool,
    pub toss_winner: Option<Address>,
    pub batter: Option<Address>,
    pub p1_commitment: Option<BytesN<32>>,
    pub p2_commitment: Option<BytesN<32>>,
    pub p1_number: Option<u32>,
    pub p2_number: Option<u32>,
    pub p1_score: u32,
    pub p2_score: u32,
    pub innings: u32,
    pub target: u32,
    pub phase: Phase,
    pub winner: Option<Address>,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Game(u32),
    GameHubAddress,
    Admin,
}

const GAME_TTL_LEDGERS: u32 = 518_400;

fn verify_proof(env: &Env, stored_commitment: &BytesN<32>, number: u32, proof_blob: &Bytes) -> bool {
    if proof_blob.len() < 132 {
        return false;
    }
    let n0 = proof_blob.get(0).unwrap_or(0) as u32;
    let n1 = proof_blob.get(1).unwrap_or(0) as u32;
    let n2 = proof_blob.get(2).unwrap_or(0) as u32;
    let n3 = proof_blob.get(3).unwrap_or(0) as u32;
    let num_inputs = (n0 << 24) | (n1 << 16) | (n2 << 8) | n3;
    if num_inputs != 2 {
        return false;
    }
    let mut proof_commitment_bytes = [0u8; 32];
    for i in 0..32 {
        proof_commitment_bytes[i] = proof_blob.get(4 + i as u32).unwrap_or(0);
    }
    let proof_commitment: BytesN<32> = BytesN::from_array(env, &proof_commitment_bytes);
    if proof_commitment != *stored_commitment {
        return false;
    }
    let r0 = proof_blob.get(64).unwrap_or(0) as u32;
    let r1 = proof_blob.get(65).unwrap_or(0) as u32;
    let r2 = proof_blob.get(66).unwrap_or(0) as u32;
    let r3 = proof_blob.get(67).unwrap_or(0) as u32;
    let proof_number = (r0 << 24) | (r1 << 16) | (r2 << 8) | r3;
    proof_number == number
}

#[contract]
pub struct HandCricketContract;

#[contractimpl]
impl HandCricketContract {

    pub fn __constructor(env: Env, admin: Address, game_hub: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::GameHubAddress, &game_hub);
    }

    pub fn start_game(env: Env, session_id: u32, player1: Address, player2: Address, player1_points: i128, player2_points: i128) -> Result<(), Error> {
        if player1 == player2 { return Err(Error::SelfPlay); }
        player1.require_auth_for_args(vec![&env, session_id.into_val(&env), player1_points.into_val(&env)]);
        player2.require_auth_for_args(vec![&env, session_id.into_val(&env), player2_points.into_val(&env)]);

        let mut seed_bytes = Bytes::new(&env);
        seed_bytes.append(&Bytes::from_array(&env, &session_id.to_be_bytes()));
        seed_bytes.append(&player1.to_string().to_bytes());
        seed_bytes.append(&player2.to_string().to_bytes());
        let seed_hash = env.crypto().keccak256(&seed_bytes);
        let seed_array = seed_hash.to_array();
        let player1_is_odd = seed_array[31] % 2 == 0;

        let game_hub_addr: Address = env.storage().instance().get(&DataKey::GameHubAddress).expect("GameHub not set");
        let game_hub = GameHubClient::new(&env, &game_hub_addr);
        game_hub.start_game(&env.current_contract_address(), &session_id, &player1, &player2, &player1_points, &player2_points);

        let game = Game {
            player1, player2, player1_points, player2_points,
            player1_is_odd, toss_winner: None, batter: None,
            p1_commitment: None, p2_commitment: None,
            p1_number: None, p2_number: None,
            p1_score: 0, p2_score: 0, innings: 1, target: 0,
            phase: Phase::TossCommit, winner: None,
        };

        let key = DataKey::Game(session_id);
        env.storage().temporary().set(&key, &game);
        env.storage().temporary().extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);
        Ok(())
    }

    pub fn commit_number(env: Env, session_id: u32, player: Address, commitment: BytesN<32>) -> Result<(), Error> {
        player.require_auth();
        let key = DataKey::Game(session_id);
        let mut game: Game = env.storage().temporary().get(&key).ok_or(Error::GameNotFound)?;
        if game.winner.is_some() { return Err(Error::GameAlreadyEnded); }
        match game.phase { Phase::TossCommit | Phase::BallCommit => {} _ => return Err(Error::WrongPhase), }

        if player == game.player1 {
            if game.p1_commitment.is_some() { return Err(Error::AlreadyCommitted); }
            game.p1_commitment = Some(commitment);
        } else if player == game.player2 {
            if game.p2_commitment.is_some() { return Err(Error::AlreadyCommitted); }
            game.p2_commitment = Some(commitment);
        } else { return Err(Error::NotPlayer); }

        if game.p1_commitment.is_some() && game.p2_commitment.is_some() {
            game.phase = match game.phase {
                Phase::TossCommit => Phase::TossReveal,
                Phase::BallCommit => Phase::BallReveal,
                _ => return Err(Error::WrongPhase),
            };
        }

        env.storage().temporary().set(&key, &game);
        env.storage().temporary().extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);
        Ok(())
    }

    pub fn reveal_number(env: Env, session_id: u32, player: Address, number: u32, proof_blob: Bytes) -> Result<(), Error> {
        player.require_auth();
        let key = DataKey::Game(session_id);
        let mut game: Game = env.storage().temporary().get(&key).ok_or(Error::GameNotFound)?;
        if game.winner.is_some() { return Err(Error::GameAlreadyEnded); }
        match game.phase { Phase::TossReveal | Phase::BallReveal => {} _ => return Err(Error::WrongPhase), }

        if player == game.player1 {
            if game.p1_number.is_some() { return Err(Error::AlreadyRevealed); }
            let commitment = game.p1_commitment.as_ref().ok_or(Error::CommitMissing)?;
            if !verify_proof(&env, commitment, number, &proof_blob) { return Err(Error::ProofInvalid); }
            game.p1_number = Some(number);
        } else if player == game.player2 {
            if game.p2_number.is_some() { return Err(Error::AlreadyRevealed); }
            let commitment = game.p2_commitment.as_ref().ok_or(Error::CommitMissing)?;
            if !verify_proof(&env, commitment, number, &proof_blob) { return Err(Error::ProofInvalid); }
            game.p2_number = Some(number);
        } else { return Err(Error::NotPlayer); }

        if game.p1_number.is_some() && game.p2_number.is_some() {
            match game.phase {
                Phase::TossReveal => { game = Self::resolve_toss(game); }
                Phase::BallReveal => { game = Self::resolve_ball(&env, session_id, game)?; }
                _ => {}
            }
        }

        env.storage().temporary().set(&key, &game);
        env.storage().temporary().extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);
        Ok(())
    }

    pub fn choose_role(env: Env, session_id: u32, player: Address, bat: bool) -> Result<(), Error> {
        player.require_auth();
        let key = DataKey::Game(session_id);
        let mut game: Game = env.storage().temporary().get(&key).ok_or(Error::GameNotFound)?;
        if game.phase != Phase::BatBowlChoice { return Err(Error::WrongPhase); }
        let toss_winner = game.toss_winner.as_ref().ok_or(Error::WrongPhase)?;
        if &player != toss_winner { return Err(Error::NotTossWinner); }

        game.batter = if bat {
            Some(player.clone())
        } else {
            if player == game.player1 { Some(game.player2.clone()) } else { Some(game.player1.clone()) }
        };

        game.p1_commitment = None; game.p2_commitment = None;
        game.p1_number = None; game.p2_number = None;
        game.phase = Phase::BallCommit;

        env.storage().temporary().set(&key, &game);
        env.storage().temporary().extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);
        Ok(())
    }

    pub fn get_game(env: Env, session_id: u32) -> Result<Game, Error> {
        let key = DataKey::Game(session_id);
        env.storage().temporary().get(&key).ok_or(Error::GameNotFound)
    }

    fn resolve_toss(mut game: Game) -> Game {
        let sum = game.p1_number.unwrap_or(0) + game.p2_number.unwrap_or(0);
        let sum_is_odd = sum % 2 == 1;
        let player1_wins = (game.player1_is_odd && sum_is_odd) || (!game.player1_is_odd && !sum_is_odd);
        game.toss_winner = if player1_wins { Some(game.player1.clone()) } else { Some(game.player2.clone()) };
        game.p1_number = None; game.p2_number = None;
        game.p1_commitment = None; game.p2_commitment = None;
        game.phase = Phase::BatBowlChoice;
        game
    }

    fn resolve_ball(env: &Env, session_id: u32, mut game: Game) -> Result<Game, Error> {
        let p1_num = game.p1_number.unwrap_or(0);
        let p2_num = game.p2_number.unwrap_or(0);
        let batter = game.batter.as_ref().ok_or(Error::WrongPhase)?.clone();
        let is_out = p1_num == p2_num;

        if is_out {
            if game.innings == 1 {
                let score = if batter == game.player1 { game.p1_score } else { game.p2_score };
                game.target = score + 1;
                game.innings = 2;
                game.batter = if batter == game.player1 { Some(game.player2.clone()) } else { Some(game.player1.clone()) };
                game.p1_commitment = None; game.p2_commitment = None;
                game.p1_number = None; game.p2_number = None;
                game.phase = Phase::BallCommit;
            } else {
                let winner = if batter == game.player1 { game.player2.clone() } else { game.player1.clone() };
                game.winner = Some(winner.clone());
                game.phase = Phase::Finished;
                Self::call_end_game(env, session_id, winner == game.player1);
            }
        } else {
            if batter == game.player1 {
                game.p1_score += p1_num;
                if game.innings == 2 && game.p1_score >= game.target {
                    game.winner = Some(game.player1.clone());
                    game.phase = Phase::Finished;
                    Self::call_end_game(env, session_id, true);
                    return Ok(game);
                }
            } else {
                game.p2_score += p2_num;
                if game.innings == 2 && game.p2_score >= game.target {
                    game.winner = Some(game.player2.clone());
                    game.phase = Phase::Finished;
                    Self::call_end_game(env, session_id, false);
                    return Ok(game);
                }
            }
            game.p1_commitment = None; game.p2_commitment = None;
            game.p1_number = None; game.p2_number = None;
            game.phase = Phase::BallCommit;
        }
        Ok(game)
    }

    fn call_end_game(env: &Env, session_id: u32, player1_won: bool) {
        let game_hub_addr: Address = env.storage().instance().get(&DataKey::GameHubAddress).expect("GameHub not set");
        GameHubClient::new(env, &game_hub_addr).end_game(&session_id, &player1_won);
    }

    pub fn get_admin(env: Env) -> Address { env.storage().instance().get(&DataKey::Admin).expect("Admin not set") }
    pub fn set_admin(env: Env, new_admin: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("Admin not set");
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }
    pub fn get_hub(env: Env) -> Address { env.storage().instance().get(&DataKey::GameHubAddress).expect("GameHub not set") }
    pub fn set_hub(env: Env, new_hub: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("Admin not set");
        admin.require_auth();
        env.storage().instance().set(&DataKey::GameHubAddress, &new_hub);
    }
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("Admin not set");
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}
