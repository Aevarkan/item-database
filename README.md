# QUICK-ITEM-DATABASE
QIDB is a database for minecraft bedrock's script Api.

This database aims to avoid the use of `JSON.stringify()` for saving `ItemStack` and `ItemStack[]`. It works with `mc structures` by saving the items in `.NBT` format, storing perfect clones of the items in a simple and fast way.

# How to install
**1)** Extract the folder
**2)** Copy scripts/QuickItemDatabaseV3.js and paste it in your BP/scripts folder
**3)** Copy entities/storage.json and paste it in your BP/entities
**4)** Import the database in your script
```js
import {QuickItemDatabase} from './QuickItemDatabaseV3.js'
```
# Contributes
Thanks to Drag0nD that gave me the idea of structures with his infinite chest addon.
https://youtu.be/Trljwe6zay8?si=Yf1gC0ZsvOyAXXEP

