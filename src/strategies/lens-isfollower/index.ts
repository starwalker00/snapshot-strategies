import { BigNumber } from '@ethersproject/bignumber';
import { formatUnits } from '@ethersproject/units';
import { call, multicall } from '../../utils';

export const author = 'starwalker00';
export const version = '0.1.0';

const lensHubProxyAddress = '0xF6BF84E5df229029C9D36dC7ABaCDBE9c0bd7b4F';
const abi = [
  'function getProfileIdByHandle(string calldata handle) external view override returns (uint256)',
  'function getFollowNFT(uint256 profileId) external view override returns (address)',
  'function balanceOf(address account) external view returns (uint256)'
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
    [options.profileHandle]
  ]);
  console.log('profileId: ', profileId.toString());

  // Get the follow NFT address
  const followNFTAddress = await call(provider, abi, [
    lensHubProxyAddress,
    'getFollowNFT',
    [profileId]
  ]);
  console.log('followNFT: ', followNFTAddress.toString());

  // Get balanceOf for each input address
  const response = await multicall(
    network,
    provider,
    abi,
    addresses.map((address: any) => [followNFTAddress, 'balanceOf', [address]]),
    { blockTag }
  );

  return Object.fromEntries(
    response.map((value, i) => [
      addresses[i],
      parseInt(formatUnits(value.toString(), 0)) > 0 ? 1 : 0
    ])
  );
}
