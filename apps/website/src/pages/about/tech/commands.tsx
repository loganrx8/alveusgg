import { type NextPage } from "next";
import Image from "next/image";
import { Fragment } from "react";

import commands, {
  type CommandCategoryId,
  commandCategories,
} from "@/data/tech/commands";
import presets from "@/data/tech/presets";
import { channels, scopeGroups } from "@/data/twitch";

import { classes } from "@/utils/classes";
import { typeSafeObjectEntries } from "@/utils/helpers";
import { camelToKebab, sentenceToKebab } from "@/utils/string-case";
import { trpc } from "@/utils/trpc";

import Button from "@/components/content/Button";
import Commands, {
  type NamedCommand,
  signature,
} from "@/components/content/Commands";
import Heading from "@/components/content/Heading";
import Link from "@/components/content/Link";
import Meta from "@/components/content/Meta";
import Section from "@/components/content/Section";
import SubNav from "@/components/content/SubNav";
import ProvideAuth from "@/components/shared/LoginWithExtraScopes";
import CopyToClipboardButton from "@/components/shared/actions/CopyToClipboardButton";
import RunCommandButton from "@/components/shared/actions/RunCommandButton";

import IconVideoCamera from "@/icons/IconVideoCamera";

import leafLeftImage1 from "@/assets/floral/leaf-left-1.png";
import leafLeftImage3 from "@/assets/floral/leaf-left-3.png";
import leafRightImage1 from "@/assets/floral/leaf-right-1.png";

const grouped = typeSafeObjectEntries(commands).reduce(
  (obj, [name, command]) => ({
    ...obj,
    [command.category]: [
      ...(obj[command.category] || []),
      {
        name,
        ...command,
      },
    ],
  }),
  {} as Record<CommandCategoryId, NamedCommand[]>,
);

const sectionLinks = [
  { name: "Commands", href: "#commands" },
  { name: "Presets", href: "#presets" },
];

const AboutTechPage: NextPage = () => {
  const { data: session } = trpc.auth.getSession.useQuery();
  const subscription = trpc.stream.getSubscription.useQuery(undefined, {
    enabled: scopeGroups.chat.every((scope) =>
      session?.user?.scopes?.includes(scope),
    ),
  });

  return (
    <>
      <Meta
        title="Chat Commands at Alveus"
        description="Documentation for the commands available in the Alveus Sanctuary Twitch chat, allowing members of the community to control the live cameras on stream."
      />

      {/* Nav background */}
      <div className="-mt-40 hidden h-40 bg-alveus-green-900 lg:block" />

      <div className="relative">
        <Image
          src={leafRightImage1}
          alt=""
          className="pointer-events-none absolute -top-8 right-0 z-30 hidden h-auto w-1/2 max-w-sm drop-shadow-md select-none lg:block xl:max-w-md"
        />

        <Section dark className="py-24">
          <div className="w-full lg:w-3/5">
            <Heading level={1}>Chat Commands at Alveus</Heading>
            <p className="text-lg">
              Moderators and members of the community in the Alveus Sanctuary
              Twitch live chat have varying levels of access to run commands in
              chat that can control what live cameras are shown on stream, what
              can be seen on each of the cameras, and what audio can be heard.
            </p>
          </div>
        </Section>
      </div>

      <SubNav links={sectionLinks} className="z-20" />

      <div className="relative">
        <Image
          src={leafLeftImage1}
          alt=""
          className="pointer-events-none absolute right-0 -bottom-32 z-10 hidden h-auto w-1/2 max-w-40 -scale-x-100 drop-shadow-md select-none lg:block"
        />

        <Section>
          <Heading
            level={2}
            className="mt-0 mb-2 scroll-mt-14"
            id="commands"
            link
          >
            Commands
          </Heading>

          <dl className="max-w-full overflow-x-auto">
            <dt>Syntax:</dt>
            <dd className="mx-2">
              <pre>
                <code className="text-sm">
                  {signature({
                    name: "example",
                    args: [
                      [
                        {
                          name: "required",
                          type: "string",
                          required: true,
                          variadic: false,
                        },
                        {
                          name: "optional",
                          type: "number",
                          required: false,
                          variadic: false,
                        },
                        {
                          name: "literal",
                          type: "choice",
                          required: false,
                          variadic: false,
                          choices: ["on", "off"],
                        },
                        {
                          name: "multiple",
                          type: "string",
                          required: false,
                          variadic: true,
                        },
                      ],
                      [
                        {
                          name: "overloaded",
                          type: "choice",
                          required: true,
                          variadic: false,
                          choices: ["up", "down"],
                        },
                        {
                          name: "values",
                          type: "number",
                          required: true,
                          variadic: true,
                        },
                        {
                          name: "flag",
                          type: "number",
                          required: false,
                          variadic: false,
                          prefix: "--speed=",
                        },
                      ],
                      [],
                    ],
                    description: "This is an example command.",
                    category: "Example",
                  })}
                </code>
              </pre>
            </dd>

            <dt>Usage:</dt>
            <dd className="mx-2">
              <ul>
                <li>
                  <code className="text-sm">!example foo</code>
                </li>
                <li>
                  <code className="text-sm">!example foo 10</code>
                </li>
                <li>
                  <code className="text-sm">!example foo 20 on</code>
                </li>
                <li>
                  <code className="text-sm">!example foo 30 off bar baz</code>
                </li>
                <li>
                  <code className="text-sm">!example up 40 50</code>
                </li>
                <li>
                  <code className="text-sm">!example</code>
                </li>
              </ul>
            </dd>
          </dl>

          <dl>
            {typeSafeObjectEntries(grouped).map(([categoryId, commands]) => {
              const category = commandCategories[categoryId];

              return (
                <Fragment key={categoryId}>
                  <dt className="mt-6">
                    <Heading
                      level={3}
                      className="scroll-mt-14 text-2xl"
                      id={`commands:${sentenceToKebab(categoryId)}`}
                      link
                    >
                      {category.heading}
                    </Heading>

                    {"description" in category && (
                      <p className="mb-4">{category.description}</p>
                    )}
                  </dt>
                  <dd className="mx-2">
                    <Commands commands={commands} />
                  </dd>
                </Fragment>
              );
            })}
          </dl>
        </Section>
      </div>

      <Section className="bg-alveus-green-100">
        <Heading
          level={2}
          className="mt-0 mb-2 scroll-mt-14"
          id="fossabot"
          link
        >
          Fossabot
        </Heading>

        <div className="flex flex-row flex-wrap items-center gap-x-16 gap-y-4 lg:flex-nowrap">
          <p className="text-lg">
            Alongside the custom chat bot for all the commands above, Fossabot
            is also used in the Twitch chat to provide a set of commands that
            anyone can access, providing easy access to a bunch of common
            information and links.
          </p>

          <Button
            href="https://fossabot.com/alveussanctuary/commands"
            external
            className="shrink-0"
          >
            Explore Fossabot Commands
          </Button>
        </div>
      </Section>

      {/* Grow the last section to cover the page */}
      <div className="relative flex grow flex-col">
        <Image
          src={leafLeftImage3}
          alt=""
          className="pointer-events-none absolute -bottom-24 left-0 z-10 hidden h-auto w-1/2 max-w-48 drop-shadow-md select-none lg:block"
        />

        <Section className="grow">
          <Heading
            level={2}
            className="mt-0 mb-2 scroll-mt-14"
            id="presets"
            link
          >
            Presets
          </Heading>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <p>
              These commands will pan, tilt and zoom the respective camera to a
              preset view described below. Anyone who is subscribed to{" "}
              <Link href="/live/twitch" external>
                Alveus Sanctuary on Twitch
              </Link>{" "}
              can run these commands in the chat.
            </p>

            <div>
              <p>
                If you&apos;re subscribed, you can run these commands directly
                from this page by clicking the{" "}
                <span className="font-semibold text-alveus-green">
                  Run command{" "}
                  <IconVideoCamera className="mb-0.5 inline-block size-4" />
                </span>{" "}
                button next to each command. This will automatically send the
                command to the{" "}
                <Link
                  href={`https://twitch.tv/${channels.alveusgg.username}`}
                  external
                >
                  {channels.alveusgg.username} Twitch chat
                </Link>{" "}
                as if you had typed it in the chat yourself.
              </p>

              <ProvideAuth scopeGroup="chat" className="mt-4" />

              {subscription.isSuccess && (
                <p className="mt-4">
                  Subscription status:{" "}
                  <span
                    className={classes(
                      "mx-1 rounded-md px-1.5 py-0.5 text-sm leading-tight text-alveus-tan",
                      subscription.data ? "bg-alveus-green" : "bg-red",
                    )}
                  >
                    {subscription.data
                      ? `Subscribed at Tier ${subscription.data.tier.replace(/0+$/, "")}`
                      : "Not subscribed"}
                  </span>
                </p>
              )}
            </div>
          </div>

          <dl>
            {typeSafeObjectEntries(presets).map(
              ([camera, { title, presets }]) => (
                <Fragment key={camera}>
                  <dt className="mt-6">
                    <Heading
                      level={3}
                      className="scroll-mt-14 text-2xl"
                      id={`presets:${camelToKebab(camera)}`}
                      link
                    >
                      {title}
                      <span className="text-sm text-alveus-green-400 italic">
                        {` (${camera.toLowerCase()})`}
                      </span>
                    </Heading>
                  </dt>
                  <dd className="mx-2">
                    <dl className="max-w-full overflow-x-auto">
                      {typeSafeObjectEntries(presets).map(([name, preset]) => (
                        <div
                          key={name}
                          className="group/preset mb-4 flex flex-col items-baseline lg:mb-0 lg:flex-row lg:gap-2"
                        >
                          <dt>
                            <pre>
                              <code className="text-sm">
                                <span className="opacity-40 group-first/preset:opacity-100">
                                  {`!ptzload ${camera.toLowerCase()} `}
                                </span>
                                {name}
                              </code>
                            </pre>
                          </dt>

                          <dd className="flex items-center gap-1">
                            <CopyToClipboardButton
                              text={`!ptzload ${camera.toLowerCase()} ${name}`}
                            />
                            <RunCommandButton
                              command="ptzload"
                              args={[camera.toLowerCase(), name]}
                              subOnly
                            />
                            <p className="text-sm text-alveus-green-400 italic">
                              {preset.description}
                            </p>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </dd>
                </Fragment>
              ),
            )}
          </dl>
        </Section>
      </div>
    </>
  );
};

export default AboutTechPage;
