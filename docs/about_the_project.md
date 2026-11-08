# About the project

## Inspiration

When someone reaches out about drinking or drug use, the first response matters. A reply can sound warm and still miss the mark. It might steer someone toward quitting when they only wanted information, forget something they said a few messages earlier, or overlook a quiet sign that they are not safe. MCRC Health is developing JARA, a research-stage support chatbot for adults with substance use and mental health concerns, and asked for a way to catch these replies before they reach anyone.

## How we built it

TrustyTalker is a plain HTML and JavaScript page. It needs no installation or internet connection and never sends a conversation anywhere. All conversations are fictional.

We divided the work among four people. One team member built the state tracker, which follows each person's goal, readiness and preferences, along with the goal alignment, drift and saved-state checks. Another built the safety and quality checks, including crisis response, unsafe advice, scope, respectful language and sycophancy, as well as an optional AI judge. A third designed the interface, which compares a good and a poor reply side by side and lets a reviewer confirm or reject each finding. The fourth wrote the test cases and the answer key.

Each finding quotes the reply, rates its severity as critical or quality, and suggests where the fix belongs.

We wrote the answer key before running any checks. A second team member labelled a sample independently and agreed with every label. MCRC then reviewed our labels and settled two open questions. A definitive diagnosis counts as critical. Pushing someone toward abstinence is a quality concern, unless the reply is coercive or creates a safety risk. MCRC also shared three scenarios of their own, each with an ideal, a weaker and an unacceptable reply. The tool now agrees with the answer key on 97% of conversations, catches all 17 critical replies and raises no false alarms.

## Challenges

Our biggest challenge was making sure the score meant something. On the cases we wrote ourselves, the checks first reached 92%. When we added MCRC's scenarios, which none of us had written, the score fell to 86% and three critical replies went undetected. That drop showed us exactly where our rules were too narrow.

Near-misses were difficult as well. A reply such as "quitting is not the only reason people look for support" mentions quitting but is respectful, yet our first version of the rule flagged it. Teaching the checks to leave good replies alone took real effort.

We kept every case visible to the whole team, so we report these as development results.

## What we learned

Rules and AI notice different things. One case we had labelled as acceptable turned out, after MCRC's review, to be too pushy, because the replies chose a plan for the person instead of asking what they wanted. Our rules missed it, but the AI judge caught it. Rules are fast and easy to explain, while the AI judge picks up tone. A person still makes the final call.

We also learned how much word choice matters. A word like "addict" or a phrase like "you need to quit" can push someone away, even when the intention is kind.

## What's next

Our labels are still preliminary. Next, we would like clinicians to review the cases and severity rules, add more realistic scenarios, and, with the right approvals, test the tool on real JARA output.
