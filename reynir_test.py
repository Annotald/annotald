from nltk import Tree

from annotald import util

import reynir_utils

_DISPLAY_TARGETS = 1

_SAMPLE_SENT = dict(
    source="""Steinunn seldi Mirko tæknilega fjarstýringu.""",
    target="""\
    ( (IP-MAT (NP-SBJ (NPR-N Steinunn))
          (VBDI seldi)
          (NP-OB2 (NPR-D Mirko))
          (NP-OB1 (ADJ-A tæknilega)
                  (N-A fjarstýringu))))""",
)

_SAMPLE_PG = dict(
    source="""Steinunn seldi Mirko tæknilega fjarstýringu. Honum blöskraði þegar þessi niðurstaða varð ljós. Sumum var hent út með hönskunum. Suma daga vil ég einfaldlega kyssa trjábankann.""",
    target="""\
( (IP-MAT (NP-SBJ (NPR-N Steinunn))
        (VBDI seldi)
        (NP-OB2 (NPR-D Mirko))
        (NP-OB1 (ADJ-A tæknilega)
                (N-A fjarstýringu))))

( (IP-MAT (NP-SBJ (PRO-D Honum))
          (VBDI blöskraði)
          (PP (P þegar)
              (CP-ADV (C 0)
                      (IP-SUB (NP-SBJ (D-N þessi)
                                      (N-N niðurstaða))
                              (RDDI varð)
                              (ADJP (ADJ-N ljós)))))))

( (IP-MAT (NP-SBJ (Q-D Sumum))
          (BEDI var)
          (VAN hent)
          (RP út)
          (PP (P með)
              (NP (NS-D hönsku$)
                  (D-D $num)))))


( (IP-MAT (NP-TMP (QS-N Suma)
                  (NS-N daga))
          (MDPI vil)
          (NP-SBJ (PRO-N ég))
          (ADVP (ADV einfaldlega))
          (VB kyssa)
          (NP-OB1 (D-A trjábanka)
                  (D-A $nn))))""",
)

_SAMPLE_PGS = dict(
    source="""Steinunn seldi Mirko tæknilega fjarstýringu. Honum blöskraði þegar þessi niðurstaða varð ljós. Sumum var hent út með hönskunum. Suma daga vil ég einfaldlega kyssa trjábankann.

Þetta mun hafa verið mjög grænn köttur. Antoine er ekki að skilja þetta viðhorf. en Anton hefur trúlega keypt nýju fjarstýringuna af Mirko.""",
    target="""\
( (IP-MAT (NP-SBJ (NPR-N Steinunn))
        (VBDI seldi)
        (NP-OB2 (NPR-D Mirko))
        (NP-OB1 (ADJ-A tæknilega)
                (N-A fjarstýringu))))

( (IP-MAT (NP-SBJ (PRO-D Honum))
          (VBDI blöskraði)
          (PP (P þegar)
              (CP-ADV (C 0)
                      (IP-SUB (NP-SBJ (D-N þessi)
                                      (N-N niðurstaða))
                              (RDDI varð)
                              (ADJP (ADJ-N ljós)))))))

( (IP-MAT (NP-SBJ (Q-D Sumum))
          (BEDI var)
          (VAN hent)
          (RP út)
          (PP (P með)
              (NP (NS-D hönsku$)
                  (D-D $num)))))


( (IP-MAT (NP-TMP (QS-N Suma)
                  (NS-N daga))
          (MDPI vil)
          (NP-SBJ (PRO-N ég))
          (ADVP (ADV einfaldlega))
          (VB kyssa)
          (NP-OB1 (D-A trjábanka)
                  (D-A $nn))))

( (IP-MAT (NP-SBJ (D-N Þetta))
          (MDPI mun)
          (HV hafa)
          (BEN verið)
          (NP-PRD (ADJP (ADV mjög)
                        (ADJ-N grænn))
                  (N-N köttur))))

( (IP-MAT (NP-SBJ (NPR-N Antoine))
          (BEPI er)
          (NEG ekki)
          (IP-INF (TO að)
                  (VB skilja)
                  (NP-OB1 (D-A þetta)
                          (N-A viðhorf)))))

( (IP-MAT (CONJ en)
          (NP-SBJ (N-N Anton))
          (HVPI hefur)
          (ADVP (ADV trúlega))
          (VBN keypt)
          (NP-OB1 (ADJ nýju)
                  (N-A fjarstýringu$)
                  (D-A $na))
          (PP (P af)
              (NP (NPR-D Mirko)))))""",
)

_SAMPLE_VBDI = dict(
    source="""Petrína lauk við skáldsöguna.""",
    target="""\
( (IP-MAT (NP-SBJ (NPR-N Petrína))
(VBDI lauk)
(PP (P við) (NP (N-A skáldsögu$) (N-A $na)))
)) """,
)

_SAMPLE_CONJP = dict(
    source="""Steinunn hugsaði enn um músina og fjarstýringuna sem var tæknileg.""",
    target="""\
( (IP-MAT (NP-SBJ (NPR-N Steinunn))
(VBDI hugsaði)
(ADVP-TMP (ADV enn))
(PP (P um) (NP (NP (N-A mús$) (D-A $ina)) (CONJP (CONJ og) (NP (N-A fjarstýringu$) (D-A $na) (CP-REL (WNP-1 0) (C sem) (IP-SUB (NP-SBJ *T*-1) (BEDI var) (ADJP (ADJ tæknileg))))))))
))""",
)

_SAMPLE_INF_PRP = dict(
    source="""Allir sem vettlingi geta valdið skulu mæta til Dalvíkur til þess að styðja aðgerðirnar.""",
    target="""\
( (IP-MAT (NP-SBJ (Q-N Allir) (CP-REL (WNP-1 0) (C sem) (IP-SUB (NP-SBJ *T*-1) (NP-OB1 (N-D vettlingi)) (MDPI geta) (VBN valdið)))) (MDPI skulu)
(VB mæta)
(PP (P til) (NP (NPR-G Dalvíkur)))
(PP (P til) (NP (PRO-G þess) (IP-INF-PRP (TO að) (VB styðja) (NP-OB1 (NS-A aðgerðir$) (D-A $nar)))))
))""",
)

_SAMPLE_CP_ADV = dict(
    source="""Anton kætist þegar einhver nemandi virðist glaður.""",
    target="""\
( (IP-MAT (NP-SBJ (NPR-N Anton))
(VBPI kætist)
(PP (ADV þegar) (CP-ADV (C 0) (IP-SUB (NP-SBJ-1 (ONE+Q-N einhver) (N-A nemandi)) (VBPI virðist) (IP-SMC (NP-SBJ *-1) (ADVP (ADJ-N glaður))))))
))""",
)

_SAMPLE_AUX = dict(source="Risaeðlan vildi hafa borðað hamsturinn.", target="")

_SAMPLE_ERR = dict(
    source="Honum blöskraði þegar þessi niðurstaða varð ljós.", target=""
)

_SAMPLE_VILJA_VBPI_01 = dict(source="Konan vill matinn.", target="")

_SAMPLE_VILJA_MDPI_01 = dict(source="Konan vill borða matinn.", target="")

_SAMPLE_VILJA_MDPI_02 = dict(source="Konan hefur borðað matinn.", target="")

_SAMPLE_VILJA_VBPI_02 = dict(source="Konan hefur matinn.", target="")

_SAMPLE_IP_IMP = dict(source="Haldið áfram göngunni.", target="")

_SAMPLE_IP_SUB = dict(
    source="En svo hófst ófriðurinn mikli, fyrst er hann lét narrast af Sturlu Sighvatssyni við Apavatn.",
    target="""\
( (IP-MAT (CONJ En-en)
          (ADVP-TMP (ADV svo-svo))
          (VBDI hófst-hefja)
          (NP-SBJ (N-N ófriður$-ófriður)
                  (D-N $inn-hinn)
                  (Q-N mikli-mikill))
          (, ,-,)
          (ADVP-TMP (ADVS fyrst-fyrr)
              (CP-REL (WADVP-1 0)
                      (C er-er)
                      (IP-SUB (ADVP-TMP *T*-1)
                              (NP-SBJ (PRO-N hann-hann))
                              (VBDI lét-láta)
                              (IP-INF (NP-SBJ *arb*)
                                      (VB narrast-narra)
                                      (PP-BY (P af-af)
                                             (NP (NPR-D Sturlu-sturla) (NPR-D Sighvatssyni-sighvatsson)))
                                      (PP (P við-við)
                                          (NP (NPR-A Apavatn-apavatn))))))))
  (ID 2008.OFSI.NAR-SAG,.1204))"""
)

_SAMPLE_ADJR = dict(
    source="Fagridalur hinn eystri er allur vaxinn víði og vafinn í grasi.",
    target="""\
( (IP-MAT (NP-SBJ (N-N Fagridalur-fagridalur)
                  (NP-PRN (D-MSN hinn-hinn) (ADJR eystri-eystur)))
          (BEP er-vera)
          (Q-N allur-allur)
          (ADJP (ADJP (VAN vaxinn-vaxa)
                      (NP (NPR-N víði-víður)))
                (CONJP (CONJ og-og)
                       (ADJP (VAN vafinn-vefja)
                             (PP (P í-í)
                                 (NP (N-D grasi-gras))))))
          (. .-.))
  (ID 1850.PILTUR.NAR-FIC,.17))""")

_SAMPLE_ADJS = dict(
    source="Hann fól mér að láta bera þangað allt það besta í mat og drykk sem til var á bænum.",
    target="""\
( (IP-MAT (NP-SBJ (PRO-N Hann-hann))
    (VBDI fól-fela)
    (NP-OB1 (PRO-D mér-ég))
    (IP-INF (TO að-að)
            (VB láta-láta)
            (IP-INF (NP-SBJ *arb*)
                    (VB bera-bera)
                    (ADVP-DIR (ADV þangað-þangað))
                    (NP-OB1 (Q-A allt-allur)
                            (D-A það-sá)
                            (ADJS-A besta-góður)
                            (PP (P í-í)
                                (NP (N-A mat-matur) (CONJ og-og) (N-A drykk-drykkur)))
                            (CP-REL (WNP-1 0)
                                    (C sem-sem)
                                    (IP-SUB (NP-SBJ *T*-1)
                                            (RP til-til)
                                            (BEDI var-vera)
                                            (PP (P á-á)
                                                (NP (N-D bæ$-bær) (D-D $num-hinn))))))))
    (. ,-,))
  (ID 2008.OFSI.NAR-SAG,.964))
    """)

SETNINGAR3_PSD = dict(source="""Ég keypti alla þessa þrjá umhverfisvænu hyljara.
Ég keypti þvottavél og hraðsuðukönnu hjá Ormsson.
Þessi hnífur er beittur og glansandi.
Líkindi þessara stjórnmálaflokka minna á sandpappír og sleipiefni.
Margar aðlaðandi kvikmyndastjörnur og málfræðihetjur mættu þetta kvöld.
Steinunn hugsaði enn um músina og fjarstýringuna sem var tæknileg.
Farðinn sem hún keypti nærir húðina vel.
Logi þótti myndarlegur.
Anton kætist þegar einhver nemandi virðist glaður.
Þeir eru svalir sem syngja um paradísarborgina.
Einhver kom til landsins sem hafði aldrei þáttað.
Mirko sendi tveimur konum leiðbeiningar sem voru ekkjur og kunnu ekki að nota fjarstýringar.
Strákarnir rákust á stelpu sem sumum þótti býsna glæsileg.
Fólk segir að hún hafi sést með karlmanni í vikunni.
Allir sem vettlingi geta valdið skulu mæta til Dalvíkur til þess að styðja aðgerðirnar.
Þegar klukkan vekur okkur fáum við morgunmat sem var framleiddur í Bandaríkjunum af þekktu stórfyrirtæki.
Petrína lauk við skáldsöguna.
og fór á fund hjá samtökum móðurmálskennara.
Samtökin hafa miklar áhyggjur af stöðu mála í íslenskri máltækni og málfræði.
Hugsanlega verður leyninefnd félagsins að senda bréf til gamals dvergs sem býr við A Þingvallavatn.
Enginn annar einstaklingur getur bjargað íslenskri tungu frá ógnum hins stafræna samtíma.
Þessi dvergur notar snjallsíma frá Samsung til að geta átt samskipti við íslenska málfræðinga.
Dagbjört og Elín voru sendar í leiðangur í A Grafarvog þegar félagið hóf aðgerðir.
Þær þurftu að tengja nýtt loftnet við farsímasendi Vodafone við botn Grafarvogs.
Forseti Íslands sat á Bessastöðum meðan þær tengdu loftnetið og mældu sendistyrkinn.
Hann titraði óstjórnlega af spenningi.""")


def compare(sample, display_targets=True):
    for tree in reynir_utils.parse_text(sample["source"], id_prefix="2018.SAMPLE"):
        print(util._formatTree(tree))
        print()
    if not display_targets:
        return
    print()
    if "target" in sample and sample["target"]:

        def block_gen(text):
            lines = []
            for line in text.split("\n"):
                line = line.strip()
                if line:
                    lines.append(line)
                elif lines:
                    yield "\n".join(lines)
                    lines = []
            if lines:
                yield "\n".join(lines)

        targets = sample["target"]
        for target in block_gen(targets):
            tree = Tree.fromstring(target)
            print(util._formatTree(tree))
    else:
        print("[NA]")


# compare(_SAMPLE_ERR, _DISPLAY_TARGETS)

# compare(_SAMPLE_SENT, _DISPLAY_TARGETS)
# compare(_SAMPLE_PG, _DISPLAY_TARGETS)
# compare(_SAMPLE_PGS, _DISPLAY_TARGETS)

# compare(_SAMPLE_AUX, _DISPLAY_TARGETS)

# compare(_SAMPLE_CONJP, _DISPLAY_TARGETS)
# compare(_SAMPLE_CP_ADV, _DISPLAY_TARGETS)

# compare(_SAMPLE_ADJR, _DISPLAY_TARGETS)
# compare(_SAMPLE_ADJS, _DISPLAY_TARGETS)

# compare(_SAMPLE_INF_PRP, _DISPLAY_TARGETS)
# compare(_SAMPLE_IP_IMP, _DISPLAY_TARGETS)
# compare(_SAMPLE_IP_SUB, _DISPLAY_TARGETS)

# compare(_SAMPLE_VILJA_VBPI_01, _DISPLAY_TARGETS)
# compare(_SAMPLE_VILJA_MDPI_01, _DISPLAY_TARGETS)

# compare(_SAMPLE_VILJA_VBPI_02, _DISPLAY_TARGETS)
# compare(_SAMPLE_VILJA_MDPI_02, _DISPLAY_TARGETS)

# compare(SETNINGAR3_PSD, 0)
