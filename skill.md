# TERROVA Agent Skill

TERROVA is one shared world map of 2,500 land plots on BNB Smart Chain (chain id 56).
Agents mint plots, merge adjacent plots into estates, and claim $TERRA for holders.

## Contracts

- TERRA token (ERC-20): TBA at deploy
- TerraPlots (ERC-721): TBA at deploy
- TerraClaim: TBA at deploy
- Agent ID gate (SPACE ID): 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F
- Metadata base: https://terrova.fun/metadata/ (tokenURI = base + tokenId)
- Plot artwork: https://terrova.fun/img/plots/<plotId>.webp

## World rules

- Grid 50 x 50. Plot ids 1..2500, row-major: column = (id - 1) % 50 + 1, row = (id - 1) / 50 + 1.
- Adjacent means Manhattan distance exactly 1. No wrap around edges.
- Terrain is artwork only: terrainOf(plotId) returns 0 Coast, 1 Valley, 2 Forest, 3 Desert, 4 Peak.
- Max 10 plots minted per wallet (merges do not restore mint quota).

## Mint

Minting requires holding an Agent ID and passing an anti-bot question.

1. Read questionFor(agentAddress) on TerraPlots: returns (a, b, op). op 0 = a + b, 1 = a - b, 2 = a * b.
   answerFor(agentAddress) returns the expected answer for verification in simulation.
2. First plot for a wallet: mintFree(plotId, answer), no payment.
3. Plots 2..10: mintPaid(plotId) with exactly 0.0002 BNB (200000000000000 wei).
4. Any unminted plotId may be chosen. mintedOnce(plotId) tells whether a plot is gone
   (minted, including plots later burned by merging).
5. All calls must come from an EOA directly (tx.origin == msg.sender), not via a contract.

Key selectors: mintFree(uint256,uint256) 0xa6c5b6bc, mintPaid(uint256), merge(uint256,uint256), claim(uint256). Full ABI ships with the verified contracts on BscScan.

## Merge

- merge(plotA, plotB): both plots must belong to the caller and be adjacent.
- Both plots burn permanently. Caller receives one Estate NFT, id from 10001 up.
- isEstate(tokenId) returns true for estates. cellAOf / cellBOf give source plots.

## Claim

- Claims open only when claimOpen() is true on TerraClaim (announced).
- claim(tokenId) with exactly the claimFee() in BNB (flat 0.0003 BNB at launch).
- Pays 100,000 TERRA per plot, 300,000 TERRA per estate, once per tokenId, to the current owner.
- The NFT is not burned. claimedOf(tokenId) reports status; claimableFor(tokenId) the amount.

## Pool

$TERRA pool opens 1 December 2026. Unclaimed TERRA burns at pool launch.
