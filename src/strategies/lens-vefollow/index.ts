import { BigNumber } from '@ethersproject/bignumber';
import { Multicaller, call } from '../../utils';

export const author = 'starwalker00';
export const version = '0.1.0';

const lensHubProxyAddress = '0xF6BF84E5df229029C9D36dC7ABaCDBE9c0bd7b4F';
const abi = [
    'function getProfileIdByHandle(string calldata handle) external view returns (uint256)',
    'function getFollowNFT(uint256 profileId) external view returns (address)',
    'function balanceOf(address account) external view returns (uint256)',
    'function totalSupply() public view returns (uint256)',
    'function mintTimestampOf(uint256 tokenId) public view returns (uint256)',
    'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)'
];

export async function strategy(
    space,
    network,
    provider,
    addresses,
    options,
    snapshot
) {
    const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';

    // Get the profileId from the profileHandle
    const profileId: BigNumber = await call(provider, abi, [
        lensHubProxyAddress,
        'getProfileIdByHandle',
        [options.profileHandle],
        { blockTag }
    ]);
    console.log('profileId: ', profileId.toString());

    // Get the follow NFT address
    const followNFTAddress = await call(provider, abi, [
        lensHubProxyAddress,
        'getFollowNFT',
        [profileId],
        { blockTag }
    ]);
    console.log('followNFT: ', followNFTAddress.toString());

    // Get the balance of follow NFT for each wallet
    const callWalletToBalanceOf = new Multicaller(
        network,
        provider,
        abi,
        { blockTag }
    );
    for (const walletAddress of addresses) {
        callWalletToBalanceOf.call(walletAddress, followNFTAddress, 'balanceOf', [
            walletAddress
        ]);
    }
    const walletToBalanceOf: Record<
        string,
        BigNumber
    > = await callWalletToBalanceOf.execute();

    // Get the first tokenId for each wallet, remove wallet with balanceOf 0 along the way
    const callWalletToTokenId = new Multicaller(
        network,
        provider,
        abi,
        { blockTag }
    );
    for (const [walletAddress, count] of Object.entries(walletToBalanceOf)) {
        for (let index = 0; index < count.toNumber() && index < 1; index++) {
            callWalletToTokenId.call(
                walletAddress.toString(),
                followNFTAddress,
                'tokenOfOwnerByIndex',
                [walletAddress, index]
            );
        }
    }
    const walletToTokenId: Record<
        string,
        BigNumber
    > = await callWalletToTokenId.execute();

    // Get the mint timestamp of the first tokenId for each wallet
    const callWalletFirstTokenIdToTimestamp = new Multicaller(
        network,
        provider,
        abi,
        { blockTag }
    );
    for (const [walletAddress, tokenId] of Object.entries(walletToTokenId)) {
        callWalletFirstTokenIdToTimestamp.call(
            walletAddress.toString(),
            followNFTAddress,
            'mintTimestampOf',
            [tokenId]
        );
    }
    const walletFirstTokenIdToTimestamp: Record<
        string,
        BigNumber
    > = await callWalletFirstTokenIdToTimestamp.execute();

    // Get given block timestamp to compute vote power against
    const { timestamp } = await provider.getBlock(blockTag);
    const refTimestamp = BigNumber.from(timestamp);

    return Object.fromEntries(
        Object.entries(walletFirstTokenIdToTimestamp).map(([address, timestamp]) =>
            [address, refTimestamp.sub(timestamp).toNumber()]
        )
    );
}