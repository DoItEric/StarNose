# reddit插件说明

## 整体逻辑
当本插件被调度时，会先获取数据，从数据库reddit_posts表中获得所有未经处理的数据，然后从rules表中获取所有相关的规则，接着进行关键字初步比对，初步比对通过的数据将调用LLM进行批量比对；

## 涉及表结构
### rules表
该表存储着所有数据筛查规则。
```sql
CREATE TABLE "public"."rules" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default" NOT NULL,
  "keywords" text[] COLLATE "pg_catalog"."default" NOT NULL DEFAULT '{}'::text[],
  "disabled" bool NOT NULL DEFAULT false,
  "last_run_at" timestamptz(6),
  "remark" text COLLATE "pg_catalog"."default",
  "extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL DEFAULT now(),
  "plugins" varchar(255) COLLATE "pg_catalog"."default",
  "prompt_file" varchar(1000) COLLATE "pg_catalog"."default",
  CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
)
;
```
1 - plugins中存储着插件的名称，格式是:",xxxx,xxxx," 所以，可以用当前插件的名称左右拼接,进行like查询；
2 - keywords中存储着进行初步筛选的关键字，格式是{xxx,xxx,xxx,xxx,xxx+xxx+xxx,xxx}，可以使用逗号拆解成数组，注意，其中"+"代表着组合关键字，也就是说在标题和内容中需要将所有关键字都匹配上才可以；
3 - prompt_file保存着LLM筛选时的提示词文件路径，在LLM筛选时调用该文件作为system prompt；
4 - description是用户填写的关心数据的规则；

### reddit_posts表
该表中存储着所有reddit数据抓取的，等待筛查的结果。
```sql
CREATE TABLE "public"."reddit_posts" (
  "id" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,
  "subreddit" varchar(100) COLLATE "pg_catalog"."default",
  "title" text COLLATE "pg_catalog"."default",
  "created_utc" int4,
  "fetched_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP,
  "source" varchar(255) COLLATE "pg_catalog"."default",
  "content" text COLLATE "pg_catalog"."default",
  "process_at" timestamp(6),
  CONSTRAINT "reddit_posts_pkey" PRIMARY KEY ("id")
)
;
```
1 - process_at 字段是数据处理时间，每当一个数据被处理完成就需要更新该字段为当前时间，时区是Asia/shanghai


## 具体执行逻辑与步骤
### 一、获取数据
1 - 获取rules数据，根据插件名称从rules表中获取相关的规则，将规则相关配置项预处理，加载相关prompt文件。
2 - 获取posts数据，从reddit_posts表中获取所有process_at为空的数据
3 - 规则匹配：当对应插件存在多个rules的时候，则首先对所有数据进行关键字匹配，将匹配通过的结果进行并集去重（根据数据源的唯一标志，以rules的数组顺序优先，去除后续中的数据，每条数据只存在一个），去重后批量LLM匹配。去重后，每条 post 仅按「保留下来的那一条」对应的 rule 做 LLM 判断（即每个 post 只调一次 LLM，用的 description 来自该 rule）

### 二、关键词匹配
1 - 首先筛查content的值是否为空字符串，如果为空，直接标记process_at并跳过
2 - 循环所有rules的关键字规则，逐个筛选，注意组合关键字的逻辑:如果均无法匹配，则标记process_at并跳过。如果可以匹配，则将任务记录下来等待后续LLM批量处理。
3 - 得到所有符合条件的关键字匹配通过的数据后，进行LLM筛选。 
4 - 关键字匹配逻辑：对于单个关键字，无论在标题或内容中出现都可以；对于组合关键字，组合的各部分可以在标题中也可以在内容中，只要相关关键字出现了就可以。

### 三、LLM匹配
1 - 首先，组合和整理数据，接着通过多线程的方式批量发起LLM请求（线程数量可以在插件的配置文件中设置，默认为10）。在发送LLM请求的时候要注意prompt的占位符，需要替换相关的内容，比如在rules中维护的、用户关心的内容描述。
（这里需要你帮我生成或修改对应prompt文件，注意文件路径在项目根目录下的prompts文件夹中）
2 - 对于LLM的返回结果要求是固定的，LLM必须返回以下信息：如果不匹配用户需求，则返回匹配失败(json对象)；如果匹配，则需要返回从用户关注角度总结的300字以内摘要(json对象)；
2.1 - 不匹配：{ "match": false }
2.2 - 匹配：{ "match": true, "summary": "..." }

### 四、入库
1 - 关键字、LLM匹配通过的数据，则单独存储入库。【这里需要你帮我建表，你需要考虑到各种插件/信息源（比如X、youtube、weibo、Instagram...）字段不同，合理抽象字段，要求是用户随时能看到主键、信息源主键、链接、标题、内容、评论数量、点赞数量、发布时间、入库时间、跟踪状态（用户在系统中点击跟踪的标记）、更新时间、未读状态（未来用户在系统中点击查看后需要更新未读）、插件源、匹配规则、信息源其他的属性或者字段】（为我生成表的SQL）。其他源后续按同一抽象扩展，避免表结构只按 Reddit 设计而难以扩展。

