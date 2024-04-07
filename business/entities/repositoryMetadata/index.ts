//
// Copyright (c) Microsoft.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//

import {
  IRepositoryMetadataProvider,
  IRepositoryMetadataCreateOptions,
  RepositoryMetadataProvider,
} from './repositoryMetadataProvider';

export async function createAndInitializeRepositoryMetadataProviderInstance(
  options?: IRepositoryMetadataCreateOptions
): Promise<IRepositoryMetadataProvider> {
  const provider = new RepositoryMetadataProvider(options);
  await provider.initialize();
  return provider;
}
