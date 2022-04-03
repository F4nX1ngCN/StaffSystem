let DATA_PATH = 'plugins/staffsystem/'

if (File.exists("EnableILandDevMode")) {  // 为了本人开发方便... 此if块可删去
    DATA_PATH = 'plugins/LXL_Plugins/Dinzhi/staffsystem/'
}

// 读取数据
let stdata = JSON.parse(File.readFrom(DATA_PATH + 'data.json'))

// Helper
function saveData() {
    File.writeTo(DATA_PATH + 'data.json',JSON.stringify(stdata))
}

function setNativePermission(xuid,perm) {
    let pm = JSON.parse(File.readFrom('permissions.json'))
    for (m in pm) {
        if (pm[m].xuid==xuid) {
            pm.splice(m,1)
            break;
        }
    }
    if (perm!='default') {
        pm.push({xuid:xuid,permission:perm})
    }
    File.writeTo('permissions.json',JSON.stringify(pm))
    mc.runcmdEx('ops reload')
}

function ArgsToName(args) {
    let name = ""
    for (n of args) {
        name += n + " "
    }
    return name.substring(0,name.length - 1)
}

// ...
let StaffSystem = {
    
    
    // 判断指定玩家是否有staff权限
    hadPerm: function (xuid) {
        return stdata.staffop.indexOf(xuid) != -1
    },

    // 给指定玩家staff权限
    add: function (xuid) {
        if (StaffSystem.hadPerm(xuid)) {
            return -1
        }
        stdata.staffop.push(xuid)
        saveData()
        return 0
    },

    
    // 移除玩家的staff权限
    del: function (xuid) {
        if (!StaffSystem.hadPerm(xuid)) {
            return -1
        }
        stdata.staffop.splice(stdata.staffop.indexOf(xuid),1)
        saveData()
        return 0
    }

}

let StaffHelper = {

    // Ban
    ban: {
        add: function (player) {
            stdata.punish.ban.push(player.xuid)
            player.kick()
            saveData()
        },
        del: function (xuid) {
            if (!StaffHelper.ban.check(xuid)) {
                return -1
            }
            stdata.punish.ban.splice(stdata.punish.ban.indexOf(xuid),1)
            saveData()
            return 0
        },
        check: function (xuid) {
            return stdata.punish.ban.indexOf(xuid) != -1 
        }
    },
    
    // Freeze
    freeze: {
        add: function (player) {
            let xuid = player.xuid
            let pos = player.blockPos
            stdata.punish.freeze[xuid] = {lockedpos: {x:pos.x,y:pos.y,z:pos.z,dimid:pos.dimid}}
            setNativePermission(xuid,'visitor')
            saveData()
        },
        del: function (xuid) {
            delete stdata.punish.freeze[xuid]
            setNativePermission(xuid,'default')
            saveData()
        },
        check: function (xuid) {
            return stdata.punish.freeze[xuid]
        }
    },

    // Kick
    kick: function (player) {
        player.kick()
    }

}

// 注册监听
mc.listen('onJoin',function (player) {
    
    let xuid = player.xuid
    if (StaffHelper.ban.check(xuid)) {
        player.kick()
        return
    }

    if (StaffHelper.freeze.check(xuid)) {
        setNativePermission(xuid,'visitor')
    }

})
mc.listen('onMobHurt',function (entity,source,damage) {
    if (!entity.isPlayer()) { return }
    let target = entity.toPlayer()
    let xuid = target.xuid
    if (StaffHelper.freeze.check(xuid)) {
        return false // cant attack freezed player.
    }
})

// 使用定时器实现锁定玩家位置，因为onMove事件的性能........
setInterval(function(params) {
    for (player of mc.getOnlinePlayers()) {
        let pos = player.blockPos
        let xuid = player.xuid
        let a = StaffHelper.freeze.check(xuid)
        if (a) {
            let ap = a.lockedpos
            if (ap.x!=pos.x || ap.y!=pos.y || ap.z!=pos.z || ap.dimid!=pos.dimid) {
                player.teleport(ap.x,ap.y,ap.z,ap.dimid)
            }
        }
    }
},1000)

// 注册命令
mc.regPlayerCmd('setstaff','添加管理员',function (pl,args) {
    let xuid = data.name2xuid(ArgsToName(args))
    if (!xuid) {
       pl.sendText('[StaffSystem] 不存在的玩家，添加失败。') 
       return
    }
    switch (StaffSystem.add(xuid)) {
       case -1:
           pl.sendText('[StaffSystem] 该玩家已经是管理员了。') 
           break;
       case 0:
           pl.sendText('[StaffSystem] 成功添加。') 
           break;
        default:
           break;
    }

},1)
mc.regPlayerCmd('rmstaff','删除管理员',function (pl,args) {
    let xuid = data.name2xuid(ArgsToName(args))
   if (!xuid) {
      pl.sendText('[StaffSystem] 不存在的玩家，删除失败。') 
      return
   }
   switch (StaffSystem.del(xuid)) {
      case -1:
          pl.sendText('[StaffSystem] 该玩家不是管理员。') 
          break;
      case 0:
          pl.sendText('[StaffSystem] 成功删除。') 
          break;
       default:
           break;
   }
},1)
mc.regPlayerCmd('unban','解封玩家',function (pl,args) {
    let xuid = data.name2xuid(ArgsToName(args))
    if (!xuid) {
       pl.sendText('[StaffSystem] 不存在的玩家，解封失败。') 
       return
    }
    switch (StaffHelper.ban.del(xuid)) {
       case -1:
           pl.sendText('[StaffSystem] 该玩家没有被封禁。') 
           break;
       case 0:
           pl.sendText('[StaffSystem] 成功解封。') 
           break;
        default:
            break;
    }
},1)
mc.regPlayerCmd('staff','玩家快捷管理',function(pl,args){
   if (!StaffSystem.hadPerm(pl.xuid)) {
       pl.sendText('[StaffSystem] 你没有权限。') 
       return
   }
   let Form = mc.newCustomForm()
   let online_pls = mc.getOnlinePlayers();
   let players = new Array;
   for(let pl of online_pls) {
       players.push(pl.realName)
   }
   Form.setTitle('Staff 系统')
   Form.addLabel('选择需要操作的玩家')
   Form.addDropdown('在线玩家',players)
   pl.sendForm(Form,function(pl,res) {
       if (!res) { return } // Form回调如果这个是Null，则玩家取消了表单
       let targetPlayer = online_pls[res[1]]
       if (!targetPlayer) {
           pl.sendText('[StaffSystem] 目标玩家下线了呢')
           return
       }
       let Mgr = mc.newSimpleForm()
       let tXuid = targetPlayer.xuid
       let isFreezed = StaffHelper.freeze.check(tXuid)
       Mgr.setTitle('Staff | ' + players[res[1]])
       Mgr.setContent('请选择需要执行的操作')
       Mgr.addButton('Ban')
       Mgr.addButton('Kick')
       if (!isFreezed)
       { Mgr.addButton('Freeze') }
       else
       { Mgr.addButton('UnFreeze') }
       pl.sendForm(Mgr,function(pl,res) {
           if (res!=0 && !res) { return }
           switch (res) {
               case 0:
                   StaffHelper.ban.add(targetPlayer)
                   break;
               case 1:
                   StaffHelper.kick(targetPlayer)
                   break;
               case 2:
                    if (!isFreezed)
                    { StaffHelper.freeze.add(targetPlayer) }
                    else
                    { StaffHelper.freeze.del(tXuid) }
                   break
               default:
                   log(2222)
                   return
                   break;
           }
           pl.sendText('[StaffSystem] 操作成功完成')
       })
   })
   
})