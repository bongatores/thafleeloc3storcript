import { Web3Storage } from 'web3.storage';
import { create } from 'ipfs-http-client';
import "dotenv/config";
import { CarReader } from '@ipld/car';
import { GraphQLClient, gql } from 'graphql-request';
import fs from 'fs';
import chalk from 'chalk'

const fleekApiKey = process.env.FLEEK_HOST_API;
const fleekClient = new GraphQLClient('https://api.fleek.co/graphql',{
    headers: {
        authorization: fleekApiKey
    }
});

console.log('Initiating IPFS client');
const ipfs = create();
const client = new Web3Storage({ token: process.env.WEB3_STORAGE_API })

const main = async () => {

  const GET_FILES = gql`
    query {
      getSitesByTeam(teamId: "${process.env.FLEEK_TEAM_ID}") {
        sites {
          id
          name
          latestDeploy {
            ipfsHash
          }
        }
      }
    }
  `;
  const data = await fleekClient.request(GET_FILES);
  // Pin locally and at Web3Storage
  for(const site of data.getSitesByTeam.sites){
    const ipfsHash = site.latestDeploy.ipfsHash;
    const name = site.name;

    if(ipfs){
      console.log(`${chalk.cyan("Pining")} ${chalk.green(ipfsHash)}`);
      ipfs.pin.add(ipfsHash).then(cid => {console.log(`${cid} pinnned!`)}).catch(err => {
        console.log(err.message)
      });
      ipfs.dag.export(ipfsHash).next().then(async item => {
        console.log(chalk.cyan(`Storing ${chalk.green(name)} hash ${ipfsHash} at web3 storage`))
        console.log(item)
        const car = await CarReader.fromBytes(item.value);
        const status = await client.status(ipfsHash);
        if(!status){
          console.log(car)
          const cid = await client.putCar(car,{
            name: name,
            maxRetries: 3
          });
          console.log(`Sucess ${name}`)
        } else {
          console.log(`${chalk.cyan(`${name} already in web3 storage`)}`)
        }
      }).catch(err => {
        console.log(`Error storing ${chalk.cyan(name)} ${chalk.red(err.message)}`)
      })
    }
  }
}
main()
