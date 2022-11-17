import { Web3Storage } from 'web3.storage';
import { create } from 'ipfs-http-client';
import "dotenv/config";
import { CarReader } from '@ipld/car';
import { GraphQLClient, gql } from 'graphql-request';
import fs from 'fs';
import chalk from 'chalk'
import shell from 'shelljs';

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
  if(!ipfs){
    console.log(chalk.red("IPFS node needed to run the script"));
    process.exit();
  }
  if (!fs.existsSync('./car')){
      fs.mkdirSync('./car');
  }
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

      console.log(`Runing ${chalk.cyan(`ipfs dag export ${ipfsHash} > ./car/${name}.car`)}`)
      shell.exec(`ipfs dag export ${ipfsHash} > ./car/${name}.car`)
      console.log(`Sucess exporting as car ${name}`)
    }
  }
  console.log(chalk.cyan(`Storing at web3 storage`));
  const files = fs.readdirSync("./car");
  for(const file of files){

    const inStream = fs.createReadStream(`./car/${file}`);
    // read and parse the entire stream in one go, this will cache the contents of
    // the car in memory so is not suitable for large files.
    console.log(`Uploading ${file} to web3.storage`);
    console.log(inStream)
    const car = await CarReader.fromIterable(inStream);
    console.log(car.cid)
    const status = await client.status(car.cid);
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
    const cid = await client.putCar(car,{
      name: file,
      maxRetries: 3
    });
    console.log(`${file} cid: ${cid}`);
  }
  process.exit();
}
main()
