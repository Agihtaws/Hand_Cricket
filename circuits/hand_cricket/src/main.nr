fn main(
    number: Field,
    salt: Field,
    commitment: pub Field,
    number_revealed: pub Field,
) {
    let n = number as u64;
    assert(n >= 1, "Number must be at least 1");
    assert(n <= 6, "Number must be at most 6");

    let hash_inputs: [Field; 2] = [number, salt];
    let computed = std::hash::pedersen_hash(hash_inputs);
    assert(computed == commitment, "Commitment mismatch");

    assert(number_revealed == number, "Revealed number does not match");
}

#[test]
fn get_commitment() {
    let inputs: [Field; 2] = [4, 12345];
    let h = std::hash::pedersen_hash(inputs);
    println(h);
}
