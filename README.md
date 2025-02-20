# QUICK-ITEM-DATABASE
QIDB is a database for minecraft bedrock's script Api.

This database aims to avoid the use of `JSON.stringify()` for saving `ItemStack` and `ItemStack[]`. It works with `mc structures` by saving the items in `.NBT` format, storing perfect clones of the items in a simple and fast way.

# How does it work?
This is a database dedicated only for items, it uses structures to store them as nbt data. It uses a simple key: string - value: ItemStack |  ItemStack[] management method, and a namespace to differenciate from other QuickItemDatabases. It has a lot of optimization features: 

Quick-access memory (**QAM**), works like a ram, it caches alredy loaded data to prevent performance loss. (created in V3.2, updated V3.6)

It does not lag since it’s made to do the minimum work possible and it’s loading times are 0-2ms

It does use background async saving (**BAS**) to avoid tick freezing but maintaining the flow syncronised with QAM. (created in V3.3)

[Visual explaination](https://cdn.discordapp.com/attachments/1252014916496527380/1327710665070350377/Screenshot_2025-01-11_194730.png?ex=67840e6a&is=6782bcea&hm=17e69277be63892303a6ae90e013f80db0db8d036fd42caa4b05f2dd09535d23&)
# Contributes
Thanks to Drag0nD that helped me a lot in the creation of the database and gave me the structure method sending me his infinite chest addon.
https://youtu.be/Trljwe6zay8?si=Yf1gC0ZsvOyAXXEP

# How to install
**1)** Extract the folder.

**2)** Copy scripts/QuickItemDatabaseV3.js and paste it in your BP/scripts folder.

**3)** Copy entities/storage.json and paste it in your BP/entities.

**4)** Import the database in your script.
```js
import {QuickItemDatabase} from './QuickItemDatabaseV3.js'

const database = new QuickItemDatabase('my_database') // read the js docs for more specific options

```
